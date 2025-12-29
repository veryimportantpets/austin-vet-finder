from django.urls import path
from . import views

urlpatterns = [
    path('pages/', views.pages_list, name='pages'),
    path('page/<int:pk>/', views.page_detail, name='page_detail'),
    path('page/<int:pk>/ready-for-review/', views.ready_for_review, name='ready_for_review'),
    path('page/<int:pk>/approve/', views.approve_page, name='approve_page'),
    path('page/<int:pk>/request-changes/', views.request_changes, name='request_changes'),
    path('page/<int:pk>/delete/', views.delete_page, name='delete_page'),
]
