from django.db import models
from django.conf import settings
from django.utils import timezone


class Notification(models.Model):
    """In-app notification for a user."""
    NOTIFICATION_TYPE_CHOICES = [
        ('message', 'New Message'),
        ('submission', 'Card Submission'),
        ('page_review', 'Page Ready for Review'),
        ('approval', 'Page Approved'),
        ('needs_info', 'More Info Requested'),
        ('overdue', 'Overdue Task'),
        ('phase_change', 'Phase Changed'),
        ('generic', 'General Notification'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    link = models.CharField(max_length=500, blank=True)
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    is_read = models.BooleanField(default=False)
    is_critical = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} -> {self.user.email}"

    def mark_read(self):
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=['is_read', 'read_at'])


class EmailLog(models.Model):
    """Log of sent emails for coalescing and rate limiting."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_logs'
    )
    notification_type = models.CharField(max_length=20)
    subject = models.CharField(max_length=200)
    is_critical = models.BooleanField(default=False)
    sent_at = models.DateTimeField(auto_now_add=True)
    coalesce_key = models.CharField(max_length=200, blank=True, db_index=True)

    class Meta:
        ordering = ['-sent_at']

    @classmethod
    def can_send_email(cls, user, notification_type, is_critical=False, coalesce_key=''):
        """Check if we can send an email based on quiet hours and rate limits."""
        from datetime import timedelta

        now = timezone.now()
        local_hour = now.hour

        # Check quiet hours for non-critical emails
        if not is_critical:
            if local_hour >= settings.NOTIFICATION_QUIET_HOURS_START or local_hour < settings.NOTIFICATION_QUIET_HOURS_END:
                return False

        # Check coalescing (skip duplicates within window)
        if coalesce_key:
            coalesce_window = now - timedelta(minutes=settings.NOTIFICATION_COALESCE_MINUTES)
            if cls.objects.filter(
                user=user,
                coalesce_key=coalesce_key,
                sent_at__gte=coalesce_window
            ).exists():
                return False

        # Check daily limit for non-critical emails
        if not is_critical:
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            daily_count = cls.objects.filter(
                user=user,
                is_critical=False,
                sent_at__gte=today_start
            ).count()
            if daily_count >= settings.NOTIFICATION_MAX_DAILY_NON_CRITICAL:
                return False

        return True
