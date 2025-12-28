from django.db import models
from django.conf import settings


class ClientOrg(models.Model):
    """Represents a client organization (e.g., a veterinary practice)."""
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Client Organization'
        verbose_name_plural = 'Client Organizations'

    def __str__(self):
        return self.name


class Membership(models.Model):
    """Links users to organizations."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    org = models.ForeignKey(
        ClientOrg,
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    is_primary_contact = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'org']
        ordering = ['org__name', 'user__email']

    def __str__(self):
        return f"{self.user.email} @ {self.org.name}"
