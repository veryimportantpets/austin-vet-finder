"""
URL configuration for DE Portal.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth
    path('auth/', include('users.urls')),

    # Main app routes
    path('', include('projects.urls')),
    path('', include('cards.urls')),
    path('', include('pages.urls')),
    path('', include('messaging.urls')),
    path('', include('change_requests.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
