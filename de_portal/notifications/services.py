"""
Notification services for sending in-app, email, and Slack notifications.
"""
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.urls import reverse

from .models import Notification, EmailLog
from integrations.slack import (
    notify_new_client_message,
    notify_client_submission,
    notify_overdue_summary,
    notify_page_approved
)


def create_notification(user, notification_type, title, message, link='', project=None, is_critical=False):
    """Create an in-app notification."""
    return Notification.objects.create(
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
        project=project,
        is_critical=is_critical
    )


def send_email_notification(user, subject, message, is_critical=False, coalesce_key=''):
    """Send an email notification with rate limiting and quiet hours."""
    if not EmailLog.can_send_email(user, 'email', is_critical, coalesce_key):
        return False

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True
        )

        EmailLog.objects.create(
            user=user,
            notification_type='email',
            subject=subject,
            is_critical=is_critical,
            coalesce_key=coalesce_key
        )
        return True
    except Exception:
        return False


def notify_new_message(thread, message):
    """Notify relevant users about a new message."""
    project = thread.project
    sender = message.sender

    # Determine recipients
    if sender.is_client:
        # Notify designer
        if project.assigned_designer:
            create_notification(
                user=project.assigned_designer,
                notification_type='message',
                title=f'New message in {project.name}',
                message=message.body[:200],
                link=f'/project/{project.id}/messages/',
                project=project,
                is_critical=True
            )

            send_email_notification(
                user=project.assigned_designer,
                subject=f'New message in {project.name}',
                message=f"{sender.get_full_name()} sent a message:\n\n{message.body}",
                is_critical=True,
                coalesce_key=f'msg-{thread.id}'
            )

        # Slack notification for internal team
        notify_new_client_message(
            project_name=project.name,
            sender_name=sender.get_full_name(),
            preview=message.body
        )
    else:
        # Notify all client members of the org
        for membership in project.org.memberships.select_related('user'):
            if membership.user != sender:
                create_notification(
                    user=membership.user,
                    notification_type='message',
                    title='New message from Digital Empathy',
                    message=message.body[:200],
                    link='/messages/',
                    project=project,
                    is_critical=True
                )

                send_email_notification(
                    user=membership.user,
                    subject=f'New message about your website project',
                    message=f"You have a new message:\n\n{message.body}",
                    is_critical=True,
                    coalesce_key=f'msg-{thread.id}'
                )


def notify_card_submission(card, submission):
    """Notify when a client submits a card."""
    project = card.project

    if project.assigned_designer:
        create_notification(
            user=project.assigned_designer,
            notification_type='submission',
            title=f'Task submitted: {card.title}',
            message=f'{submission.submitted_by.get_full_name()} submitted "{card.title}"',
            link=f'/project/{project.id}/card/{card.id}/',
            project=project
        )

    notify_client_submission(
        project_name=project.name,
        card_title=card.title,
        client_name=submission.submitted_by.get_full_name() if submission.submitted_by else 'Client'
    )


def notify_page_ready_for_review(page):
    """Notify client that a page is ready for review."""
    project = page.project

    for membership in project.org.memberships.select_related('user'):
        create_notification(
            user=membership.user,
            notification_type='page_review',
            title=f'Page ready for review: {page.title}',
            message='Please review this page and approve it or request changes.',
            link=f'/page/{page.id}/',
            project=project,
            is_critical=True
        )

        send_email_notification(
            user=membership.user,
            subject=f'Your {page.title} page is ready for review',
            message=f'The {page.title} page for your website is now ready for you to review.\n\nPlease log in to approve it or request changes.',
            is_critical=True,
            coalesce_key=f'page-review-{page.id}'
        )


def notify_page_approved_by_client(page, approver):
    """Notify designer that client approved a page."""
    project = page.project

    if project.assigned_designer:
        create_notification(
            user=project.assigned_designer,
            notification_type='approval',
            title=f'Page approved: {page.title}',
            message=f'{approver.get_full_name()} approved the {page.title} page',
            link=f'/project/{project.id}/page/{page.id}/',
            project=project
        )

    notify_page_approved(
        project_name=project.name,
        page_title=page.title,
        client_name=approver.get_full_name()
    )


def notify_needs_more_info(card):
    """Notify client that more info is needed on a card."""
    project = card.project

    for membership in project.org.memberships.select_related('user'):
        create_notification(
            user=membership.user,
            notification_type='needs_info',
            title=f'More info needed: {card.title}',
            message='We need additional information to complete this task.',
            link=f'/card/{card.id}/',
            project=project,
            is_critical=True
        )

        send_email_notification(
            user=membership.user,
            subject=f'More information needed: {card.title}',
            message=f'We need some additional information for "{card.title}".\n\nPlease log in to see what\'s needed.',
            is_critical=True
        )


def notify_overdue_cards():
    """Send notifications for overdue client cards (called by management command)."""
    from django.utils import timezone
    from cards.models import Card

    today = timezone.now().date()
    overdue_cards = Card.objects.filter(
        visibility='client',
        status__in=['todo', 'needs_info'],
        due_date__lt=today,
        project__status='active'
    ).select_related('project', 'project__org', 'project__assigned_designer')

    # Group by project for summary
    projects = {}
    for card in overdue_cards:
        if card.project_id not in projects:
            projects[card.project_id] = []
        projects[card.project_id].append(card)

    # Send client reminders
    for project_id, cards in projects.items():
        project = cards[0].project
        for membership in project.org.memberships.select_related('user'):
            for card in cards[:3]:  # Limit to 3 cards per notification
                send_email_notification(
                    user=membership.user,
                    subject=f'Reminder: {card.title} is overdue',
                    message=f'Your task "{card.title}" was due on {card.due_date}. Please complete it as soon as possible.',
                    is_critical=False,
                    coalesce_key=f'overdue-{card.id}'
                )

    # Send Slack summary
    if overdue_cards:
        items = [
            {
                'project': card.project.name,
                'card': card.title,
                'due_date': str(card.due_date)
            }
            for card in overdue_cards[:20]
        ]
        notify_overdue_summary(items)
