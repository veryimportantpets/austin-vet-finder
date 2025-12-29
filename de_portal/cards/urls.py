from django.urls import path
from . import views

urlpatterns = [
    path('tasks/', views.tasks_list, name='tasks'),
    path('card/<int:pk>/', views.card_detail, name='card_detail'),
    path('card/<int:pk>/submit/', views.submit_card, name='submit_card'),
    path('card/<int:pk>/accept/', views.accept_card, name='accept_card'),
    path('card/<int:pk>/needs-info/', views.needs_info_card, name='needs_info_card'),
    path('project/<int:pk>/internal-cards/', views.internal_cards_list, name='internal_cards'),
]
