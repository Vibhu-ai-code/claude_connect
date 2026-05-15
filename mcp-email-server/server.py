"""MCP server for on-premise email accounts via IMAP + SMTP.

Configuration via environment variables:
  IMAP_HOST         IMAP server hostname (required)
  IMAP_PORT         IMAP server port (default: 993 if SSL else 143)
  IMAP_USER         IMAP username (required)
  IMAP_PASS         IMAP password (required)
  IMAP_USE_SSL      "true" to use implicit SSL (default: true)
  IMAP_TIMEOUT      Socket timeout in seconds (default: 30)

  SMTP_HOST         SMTP server hostname (required for send_email)
  SMTP_PORT         SMTP server port (default: 587)
  SMTP_USER         SMTP username (default: IMAP_USER)
  SMTP_PASS         SMTP password (default: IMAP_PASS)
  SMTP_USE_TLS      "true" to use STARTTLS (default: true)
  SMTP_USE_SSL      "true" to use implicit SSL (default: false)
  SMTP_FROM         Default From: address (default: SMTP_USER)
  SMTP_TIMEOUT      Socket timeout in seconds (default: 30)
"""

from __future__ import annotations

import base64
import email
import email.message
import imaplib
import os
import re
import smtplib
import ssl
from dataclasses import dataclass
from datetime import datetime
from email.encoders import encode_base64
from email.header import decode_header, make_header
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("on-prem-email")


def _env(name: str, default: Optional[str] = None, required: bool = False) -> Optional[str]:
    value = os.environ.get(name, default)
    if required and not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _bool_env(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class ImapConfig:
    host: str
    port: int
    user: str
    password: str
    use_ssl: bool
    timeout: int


def _imap_config() -> ImapConfig:
    use_ssl = _bool_env("IMAP_USE_SSL", True)
    default_port = 993 if use_ssl else 143
    return ImapConfig(
        host=_env("IMAP_HOST", required=True),
        port=int(_env("IMAP_PORT", str(default_port))),
        user=_env("IMAP_USER", required=True),
        password=_env("IMAP_PASS", required=True),
        use_ssl=use_ssl,
        timeout=int(_env("IMAP_TIMEOUT", "30")),
    )


def _imap_connect(folder: Optional[str] = None, readonly: bool = False) -> imaplib.IMAP4:
    cfg = _imap_config()
    if cfg.use_ssl:
        ctx = ssl.create_default_context()
        client: imaplib.IMAP4 = imaplib.IMAP4_SSL(
            cfg.host, cfg.port, ssl_context=ctx, timeout=cfg.timeout
        )
    else:
        client = imaplib.IMAP4(cfg.host, cfg.port, timeout=cfg.timeout)
    client.login(cfg.user, cfg.password)
    if folder is not None:
        typ, data = client.select(_imap_quote(folder), readonly=readonly)
        if typ != "OK":
            _safe_logout(client)
            detail = data[0].decode("utf-8", errors="replace") if data and data[0] else ""
            raise RuntimeError(f"Could not select folder {folder!r}: {detail}")
    return client


def _safe_logout(client: imaplib.IMAP4) -> None:
    try:
        if client.state == "SELECTED":
            client.close()
    except Exception:
        pass
    try:
        client.logout()
    except Exception:
        pass


def _imap_quote(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _imap_date(value: str) -> str:
    # IMAP wants DD-Mon-YYYY; accept ISO YYYY-MM-DD from callers.
    dt = datetime.strptime(value, "%Y-%m-%d")
    return dt.strftime("%d-%b-%Y")


def _decode_mime_header(value: Optional[str]) -> str:
    if value is None:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def _parse_uids(data: list) -> list[bytes]:
    if not data or data[0] is None:
        return []
    return data[0].split()


_FLAGS_RE = re.compile(rb"FLAGS \(([^)]*)\)")


def _extract_flags(meta: bytes) -> list[str]:
    match = _FLAGS_RE.search(meta)
    if not match:
        return []
    return [f.decode("ascii", errors="replace") for f in match.group(1).split()]


def _decode_payload(part: email.message.Message) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        return ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def _fetch_summary(client: imaplib.IMAP4, uid: bytes) -> dict[str, Any]:
    typ, data = client.uid(
        "fetch",
        uid,
        "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID)])",
    )
    if typ != "OK" or not data or data[0] is None:
        return {"uid": uid.decode(), "error": "fetch failed"}

    flags: list[str] = []
    header_bytes = b""
    for item in data:
        if isinstance(item, tuple) and len(item) == 2:
            flags = _extract_flags(item[0] or b"")
            header_bytes = item[1] or b""
    msg = email.message_from_bytes(header_bytes)
    return {
        "uid": uid.decode(),
        "flags": flags,
        "unread": "\\Seen" not in flags,
        "subject": _decode_mime_header(msg.get("Subject")),
        "from": _decode_mime_header(msg.get("From")),
        "to": _decode_mime_header(msg.get("To")),
        "cc": _decode_mime_header(msg.get("Cc")),
        "date": msg.get("Date"),
        "message_id": msg.get("Message-ID"),
    }


def _render_message(msg: email.message.Message, uid: str, flags: list[str]) -> dict[str, Any]:
    text_body = ""
    html_body = ""
    attachments: list[dict[str, Any]] = []
    for part in msg.walk():
        if part.is_multipart():
            continue
        disposition = (part.get("Content-Disposition") or "").lower()
        ctype = part.get_content_type()
        filename = part.get_filename()
        if "attachment" in disposition or filename:
            payload = part.get_payload(decode=True) or b""
            attachments.append({
                "filename": _decode_mime_header(filename or ""),
                "content_type": ctype,
                "size": len(payload),
            })
        elif ctype == "text/plain" and not text_body:
            text_body = _decode_payload(part)
        elif ctype == "text/html" and not html_body:
            html_body = _decode_payload(part)
    return {
        "uid": uid,
        "flags": flags,
        "unread": "\\Seen" not in flags,
        "subject": _decode_mime_header(msg.get("Subject")),
        "from": _decode_mime_header(msg.get("From")),
        "to": _decode_mime_header(msg.get("To")),
        "cc": _decode_mime_header(msg.get("Cc")),
        "bcc": _decode_mime_header(msg.get("Bcc")),
        "reply_to": _decode_mime_header(msg.get("Reply-To")),
        "date": msg.get("Date"),
        "message_id": msg.get("Message-ID"),
        "in_reply_to": msg.get("In-Reply-To"),
        "references": msg.get("References"),
        "text": text_body,
        "html": html_body,
        "attachments": attachments,
    }


_FOLDER_LINE_RE = re.compile(r'\((?P<flags>[^)]*)\) "(?P<sep>[^"]*)" (?P<name>.+)')


@mcp.tool()
def list_folders() -> list[dict[str, Any]]:
    """List all mailboxes/folders on the IMAP account."""
    client = _imap_connect()
    try:
        typ, data = client.list()
        if typ != "OK":
            raise RuntimeError("LIST command failed")
        folders: list[dict[str, Any]] = []
        for raw in data:
            if raw is None:
                continue
            line = raw.decode("utf-8", errors="replace")
            match = _FOLDER_LINE_RE.match(line)
            if not match:
                continue
            name = match.group("name").strip()
            if name.startswith('"') and name.endswith('"'):
                name = name[1:-1]
            folders.append({
                "name": name,
                "flags": match.group("flags").split(),
                "delimiter": match.group("sep"),
            })
        return folders
    finally:
        _safe_logout(client)


@mcp.tool()
def list_emails(
    folder: str = "INBOX",
    limit: int = 20,
    unread_only: bool = False,
) -> list[dict[str, Any]]:
    """List recent emails in a folder, newest first."""
    client = _imap_connect(folder, readonly=True)
    try:
        criteria = ["UNSEEN"] if unread_only else ["ALL"]
        typ, data = client.uid("search", None, *criteria)
        if typ != "OK":
            raise RuntimeError("SEARCH failed")
        uids = list(reversed(_parse_uids(data)))[: max(0, limit)]
        return [_fetch_summary(client, uid) for uid in uids]
    finally:
        _safe_logout(client)


@mcp.tool()
def search_emails(
    folder: str = "INBOX",
    subject: Optional[str] = None,
    sender: Optional[str] = None,
    to: Optional[str] = None,
    body: Optional[str] = None,
    since: Optional[str] = None,
    before: Optional[str] = None,
    unread_only: bool = False,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Search emails using IMAP SEARCH. Dates are ISO YYYY-MM-DD."""
    client = _imap_connect(folder, readonly=True)
    try:
        criteria: list[str] = []
        if unread_only:
            criteria.append("UNSEEN")
        if subject:
            criteria += ["SUBJECT", _imap_quote(subject)]
        if sender:
            criteria += ["FROM", _imap_quote(sender)]
        if to:
            criteria += ["TO", _imap_quote(to)]
        if body:
            criteria += ["BODY", _imap_quote(body)]
        if since:
            criteria += ["SINCE", _imap_date(since)]
        if before:
            criteria += ["BEFORE", _imap_date(before)]
        if not criteria:
            criteria = ["ALL"]
        typ, data = client.uid("search", None, *criteria)
        if typ != "OK":
            raise RuntimeError("SEARCH failed")
        uids = list(reversed(_parse_uids(data)))[: max(0, limit)]
        return [_fetch_summary(client, uid) for uid in uids]
    finally:
        _safe_logout(client)


@mcp.tool()
def read_email(folder: str, uid: str) -> dict[str, Any]:
    """Fetch the full content (headers, text, html, attachment metadata) of an email."""
    client = _imap_connect(folder, readonly=True)
    try:
        typ, data = client.uid("fetch", uid, "(BODY.PEEK[] FLAGS)")
        if typ != "OK" or not data or data[0] is None:
            raise RuntimeError("FETCH failed")
        flags: list[str] = []
        raw_bytes = b""
        for item in data:
            if isinstance(item, tuple) and len(item) == 2:
                flags = _extract_flags(item[0] or b"")
                raw_bytes = item[1] or b""
        msg = email.message_from_bytes(raw_bytes)
        return _render_message(msg, uid, flags)
    finally:
        _safe_logout(client)


@mcp.tool()
def get_attachment(folder: str, uid: str, filename: str) -> dict[str, Any]:
    """Download a single attachment as base64. Match is by exact filename."""
    client = _imap_connect(folder, readonly=True)
    try:
        typ, data = client.uid("fetch", uid, "(BODY.PEEK[])")
        if typ != "OK" or not data or data[0] is None:
            raise RuntimeError("FETCH failed")
        raw_bytes = b""
        for item in data:
            if isinstance(item, tuple) and len(item) == 2:
                raw_bytes = item[1] or b""
        msg = email.message_from_bytes(raw_bytes)
        for part in msg.walk():
            if part.is_multipart():
                continue
            part_filename = _decode_mime_header(part.get_filename() or "")
            if part_filename == filename:
                payload = part.get_payload(decode=True) or b""
                return {
                    "uid": uid,
                    "filename": part_filename,
                    "content_type": part.get_content_type(),
                    "size": len(payload),
                    "content_base64": base64.b64encode(payload).decode("ascii"),
                }
        raise RuntimeError(f"Attachment {filename!r} not found on UID {uid}")
    finally:
        _safe_logout(client)


@mcp.tool()
def mark_read(folder: str, uid: str, read: bool = True) -> dict[str, Any]:
    """Mark an email as read (read=True) or unread (read=False)."""
    client = _imap_connect(folder, readonly=False)
    try:
        op = "+FLAGS" if read else "-FLAGS"
        typ, _ = client.uid("store", uid, op, "(\\Seen)")
        if typ != "OK":
            raise RuntimeError("STORE failed")
        return {"ok": True, "uid": uid, "read": read}
    finally:
        _safe_logout(client)


@mcp.tool()
def delete_email(folder: str, uid: str, expunge: bool = True) -> dict[str, Any]:
    """Mark an email \\Deleted; expunge by default to remove it permanently."""
    client = _imap_connect(folder, readonly=False)
    try:
        typ, _ = client.uid("store", uid, "+FLAGS", "(\\Deleted)")
        if typ != "OK":
            raise RuntimeError("STORE failed")
        if expunge:
            client.expunge()
        return {"ok": True, "uid": uid, "expunged": expunge}
    finally:
        _safe_logout(client)


@mcp.tool()
def move_email(folder: str, uid: str, dest_folder: str) -> dict[str, Any]:
    """Move an email to another folder via COPY + \\Deleted + EXPUNGE (works on any IMAP server)."""
    client = _imap_connect(folder, readonly=False)
    try:
        typ, data = client.uid("copy", uid, _imap_quote(dest_folder))
        if typ != "OK":
            detail = data[0].decode("utf-8", errors="replace") if data and data[0] else ""
            raise RuntimeError(f"COPY to {dest_folder!r} failed: {detail}")
        client.uid("store", uid, "+FLAGS", "(\\Deleted)")
        client.expunge()
        return {"ok": True, "uid": uid, "dest": dest_folder}
    finally:
        _safe_logout(client)


@mcp.tool()
def send_email(
    to: list[str],
    subject: str,
    body: str,
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    html: Optional[str] = None,
    attachments: Optional[list[dict[str, str]]] = None,
    reply_to_message_id: Optional[str] = None,
) -> dict[str, Any]:
    """Send an email via SMTP.

    attachments: list of {"filename": str, "content_type": str, "content_base64": str}
    reply_to_message_id: original Message-ID to thread the reply.
    """
    smtp_host = _env("SMTP_HOST", required=True)
    smtp_port = int(_env("SMTP_PORT", "587"))
    smtp_user = _env("SMTP_USER", _env("IMAP_USER"))
    smtp_pass = _env("SMTP_PASS", _env("IMAP_PASS"))
    smtp_from = _env("SMTP_FROM", smtp_user)
    use_tls = _bool_env("SMTP_USE_TLS", True)
    use_ssl = _bool_env("SMTP_USE_SSL", False)
    timeout = int(_env("SMTP_TIMEOUT", "30"))

    msg = MIMEMultipart("mixed")
    msg["From"] = smtp_from
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = ", ".join(cc)
    if reply_to_message_id:
        msg["In-Reply-To"] = reply_to_message_id
        msg["References"] = reply_to_message_id

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(body, "plain", "utf-8"))
    if html:
        alt.attach(MIMEText(html, "html", "utf-8"))
    msg.attach(alt)

    for att in attachments or []:
        filename = att.get("filename") or "attachment"
        content_type = att.get("content_type") or "application/octet-stream"
        maintype, _, subtype = content_type.partition("/")
        data = base64.b64decode(att.get("content_base64", ""))
        part = MIMEBase(maintype or "application", subtype or "octet-stream")
        part.set_payload(data)
        encode_base64(part)
        part.add_header("Content-Disposition", "attachment", filename=filename)
        msg.attach(part)

    recipients = list(to) + list(cc or []) + list(bcc or [])
    if not recipients:
        raise ValueError("send_email requires at least one recipient")

    if use_ssl:
        ctx = ssl.create_default_context()
        smtp: smtplib.SMTP = smtplib.SMTP_SSL(smtp_host, smtp_port, context=ctx, timeout=timeout)
    else:
        smtp = smtplib.SMTP(smtp_host, smtp_port, timeout=timeout)
    try:
        smtp.ehlo()
        if use_tls and not use_ssl:
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
        if smtp_user and smtp_pass:
            smtp.login(smtp_user, smtp_pass)
        smtp.sendmail(smtp_from, recipients, msg.as_string())
    finally:
        try:
            smtp.quit()
        except Exception:
            pass

    return {
        "ok": True,
        "from": smtp_from,
        "to": to,
        "cc": cc or [],
        "bcc": bcc or [],
        "subject": subject,
    }


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
