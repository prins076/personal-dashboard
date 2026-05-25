"""FastAPI application entry point.

This module is intentionally minimal — it wires up CORS for the local
frontend dev server and exposes an empty router mount structure that
later issues will fill in with concrete handlers.
"""

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.food import router as food_router
from routers.goals import router as goals_router
from routers.water import router as water_router
from routers.weight import router as weight_router

app = FastAPI(title="Fitness Tracker API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

meals_router = APIRouter(prefix="/meals", tags=["meals"])
exercise_router = APIRouter(prefix="/exercise", tags=["exercise"])
dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])

for sub in (
    meals_router,
    exercise_router,
    dashboard_router,
    food_router,
    goals_router,
    water_router,
    weight_router,
):
    api_router.include_router(sub)

app.include_router(api_router)
