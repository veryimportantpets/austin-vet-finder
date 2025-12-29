from django.contrib import admin
from .models import ClientOrg, Membership


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 1
    raw_id_fields = ['user']


@admin.register(ClientOrg)
class ClientOrgAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}
    inlines = [MembershipInline]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'org', 'is_primary_contact', 'created_at']
    list_filter = ['is_primary_contact', 'org']
    search_fields = ['user__email', 'org__name']
    raw_id_fields = ['user', 'org']
