from django.db import models
from django.conf import settings
from django.utils import timezone


class Card(models.Model):
    """A task card that clients or designers complete."""
    VISIBILITY_CHOICES = [
        ('client', 'Client'),
        ('internal', 'Internal'),
    ]

    KIND_CHOICES = [
        ('client_task', 'Client Task'),
        ('internal_task', 'Internal Task'),
        ('page_review', 'Page Review'),
        ('info', 'Information'),
    ]

    STATUS_CHOICES = [
        ('todo', 'To Do'),
        ('submitted', 'Submitted'),
        ('needs_info', 'Needs More Info'),
        ('accepted', 'Accepted'),
    ]

    ASSIGNED_ROLE_CHOICES = [
        ('client', 'Client'),
        ('designer', 'Designer'),
    ]

    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='cards'
    )
    page = models.ForeignKey(
        'pages.Page',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='cards'
    )
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='client')
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default='client_task')
    title = models.CharField(max_length=200)
    why_it_matters = models.TextField(blank=True, help_text="Brief explanation of importance")
    instructions = models.TextField(blank=True)
    best_practices = models.TextField(blank=True, help_text="Collapsible guidance")
    due_date = models.DateField(null=True, blank=True)
    required = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='todo')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_cards'
    )
    assigned_to_role = models.CharField(
        max_length=20,
        choices=ASSIGNED_ROLE_CHOICES,
        default='client'
    )
    drive_folder_hint = models.CharField(max_length=200, blank=True)
    phase = models.CharField(max_length=20, blank=True, help_text="Phase this card belongs to")
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', '-created_at']

    def __str__(self):
        return self.title

    @property
    def is_overdue(self):
        if not self.due_date:
            return False
        return self.due_date < timezone.now().date() and self.status not in ['accepted', 'submitted']

    @property
    def latest_submission(self):
        return self.submissions.order_by('-created_at').first()

    def submit(self, text_content='', submitted_by=None):
        """Create a submission for this card."""
        submission = CardSubmission.objects.create(
            card=self,
            text_content=text_content,
            submitted_by=submitted_by
        )
        self.status = 'submitted'
        self.save(update_fields=['status', 'updated_at'])
        return submission

    def accept(self):
        """Accept the card submission."""
        self.status = 'accepted'
        self.save(update_fields=['status', 'updated_at'])

    def request_more_info(self):
        """Request more information from the client."""
        self.status = 'needs_info'
        self.save(update_fields=['status', 'updated_at'])


class CardSubmission(models.Model):
    """A submission for a card, including text content and attachments."""
    card = models.ForeignKey(
        Card,
        on_delete=models.CASCADE,
        related_name='submissions'
    )
    text_content = models.TextField(blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Submission for {self.card.title}"


class Attachment(models.Model):
    """File attachment for card submissions or messages."""
    submission = models.ForeignKey(
        CardSubmission,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments'
    )
    message = models.ForeignKey(
        'messaging.Message',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments'
    )
    filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500, blank=True, help_text="Local path or Drive file ID")
    file_url = models.URLField(blank=True)
    file_size = models.IntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True)
    storage_backend = models.CharField(max_length=20, default='local')
    storage_ref = models.JSONField(default=dict, blank=True)  # Backend-specific metadata
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.filename

    def get_download_url(self):
        """Get the URL to download this attachment."""
        from integrations.storage import get_storage_adapter
        adapter = get_storage_adapter()
        return adapter.get_download_url(self)
