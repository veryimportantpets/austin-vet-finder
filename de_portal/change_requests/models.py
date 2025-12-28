from django.db import models
from django.conf import settings


class ChangeRequest(models.Model):
    """A request from a client for changes to the project scope."""
    STATUS_CHOICES = [
        ('requested', 'Requested'),
        ('under_review', 'Under Review'),
        ('approved', 'Approved'),
        ('declined', 'Declined'),
        ('scheduled', 'Scheduled'),
    ]

    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='change_requests'
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='change_requests'
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    response = models.TextField(blank=True, help_text="Designer/admin response")
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='responded_change_requests'
    )
    responded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

    def approve(self, responder, response=''):
        from django.utils import timezone
        self.status = 'approved'
        self.response = response
        self.responded_by = responder
        self.responded_at = timezone.now()
        self.save()

    def decline(self, responder, response=''):
        from django.utils import timezone
        self.status = 'declined'
        self.response = response
        self.responded_by = responder
        self.responded_at = timezone.now()
        self.save()

    def schedule(self, responder, response=''):
        from django.utils import timezone
        self.status = 'scheduled'
        self.response = response
        self.responded_by = responder
        self.responded_at = timezone.now()
        self.save()
