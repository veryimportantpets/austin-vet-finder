"""
Slack webhook integration for internal notifications.
"""
import json
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def send_slack_notification(message: str, blocks: list = None) -> bool:
    """
    Send a notification to the configured Slack webhook.

    Args:
        message: Plain text fallback message
        blocks: Optional Slack Block Kit blocks for rich formatting

    Returns:
        True if sent successfully, False otherwise
    """
    webhook_url = settings.SLACK_WEBHOOK_URL

    if not webhook_url:
        logger.debug("Slack webhook URL not configured, skipping notification")
        return False

    payload = {'text': message}
    if blocks:
        payload['blocks'] = blocks

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        return True
    except requests.RequestException as e:
        logger.error(f"Failed to send Slack notification: {e}")
        return False


def notify_new_client_message(project_name: str, sender_name: str, preview: str):
    """Notify when a client sends a message that needs DE response."""
    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":speech_balloon: *New message in {project_name}*\n>{preview[:200]}"
            }
        },
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"From: {sender_name}"}
            ]
        }
    ]
    send_slack_notification(
        f"New message from {sender_name} in {project_name}: {preview[:100]}",
        blocks
    )


def notify_client_submission(project_name: str, card_title: str, client_name: str):
    """Notify when a client submits a task card."""
    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":white_check_mark: *Task submitted in {project_name}*\n*{card_title}*"
            }
        },
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"Submitted by: {client_name}"}
            ]
        }
    ]
    send_slack_notification(
        f"Task '{card_title}' submitted by {client_name} in {project_name}",
        blocks
    )


def notify_overdue_summary(overdue_items: list):
    """Send daily summary of overdue client tasks."""
    if not overdue_items:
        return

    items_text = "\n".join([
        f"- *{item['project']}*: {item['card']} (due {item['due_date']})"
        for item in overdue_items[:10]
    ])

    if len(overdue_items) > 10:
        items_text += f"\n...and {len(overdue_items) - 10} more"

    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":warning: *{len(overdue_items)} overdue client tasks*"
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": items_text
            }
        }
    ]
    send_slack_notification(
        f"{len(overdue_items)} overdue client tasks need attention",
        blocks
    )


def notify_page_approved(project_name: str, page_title: str, client_name: str):
    """Notify when a client approves a page."""
    send_slack_notification(
        f":tada: Page '{page_title}' approved by {client_name} in {project_name}"
    )
