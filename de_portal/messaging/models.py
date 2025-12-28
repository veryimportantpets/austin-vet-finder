from django.db import models
from django.conf import settings


class Thread(models.Model):
    """A conversation thread for project chat or card discussions."""
    THREAD_TYPE_CHOICES = [
        ('project_chat', 'Project Chat'),
        ('card_thread', 'Card Thread'),
    ]

    TRIAGE_STATE_CHOICES = [
        ('needs_de', 'Needs DE Response'),
        ('waiting_client', 'Waiting on Client'),
        ('resolved', 'Resolved'),
    ]

    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='threads'
    )
    card = models.ForeignKey(
        'cards.Card',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='threads'
    )
    thread_type = models.CharField(max_length=20, choices=THREAD_TYPE_CHOICES)
    triage_state = models.CharField(
        max_length=20,
        choices=TRIAGE_STATE_CHOICES,
        default='waiting_client'
    )
    last_message_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_message_at']

    def __str__(self):
        if self.card:
            return f"Thread: {self.card.title}"
        return f"Project Chat: {self.project.name}"

    def add_message(self, sender, body):
        """Add a message and update triage state based on sender role."""
        from django.utils import timezone

        message = Message.objects.create(
            thread=self,
            sender=sender,
            body=body
        )

        self.last_message_at = timezone.now()

        # Update triage state based on who sent the message
        if sender.is_client:
            self.triage_state = 'needs_de'
        else:
            self.triage_state = 'waiting_client'

        self.save(update_fields=['triage_state', 'last_message_at', 'updated_at'])
        return message

    def mark_resolved(self):
        self.triage_state = 'resolved'
        self.save(update_fields=['triage_state', 'updated_at'])

    @classmethod
    def get_or_create_project_chat(cls, project):
        """Get or create the main project chat thread."""
        thread, created = cls.objects.get_or_create(
            project=project,
            thread_type='project_chat',
            card=None
        )
        return thread

    @classmethod
    def get_or_create_card_thread(cls, card):
        """Get or create a thread for a specific card."""
        thread, created = cls.objects.get_or_create(
            project=card.project,
            card=card,
            thread_type='card_thread'
        )
        return thread


class Message(models.Model):
    """A message in a thread."""
    thread = models.ForeignKey(
        Thread,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_messages'
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        sender_name = self.sender.get_short_name() if self.sender else 'Unknown'
        return f"{sender_name}: {self.body[:50]}"
