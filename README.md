📱 WoodWiz — Bark-Based Wood Identification (Proof of Concept)

WoodWiz is a mobile proof-of-concept application that demonstrates the technical feasibility of identifying wood species using images of tree bark. The project is being developed as part of Project & Portfolio IV and serves as the foundation for a larger, production-grade application.

This repository contains the code-only academic version of the project for evaluation purposes.

🎯 Project Goal

WoodWiz aims to provide a simple, fast, field-friendly experience where a user can:

Capture or select an image of tree bark

Submit the image for identification

Receive structured information about the matched wood species

The interface is intentionally minimal and high-contrast to support real-world outdoor use (sunlight, gloves, distractions, quick interactions).

🧠 Technologies Used

All technologies listed below are actively implemented in the working prototype:

Expo — Cross-platform mobile development environment

React Native — Mobile UI framework

TypeScript — Strong typing for maintainability and scalability

Expo ImagePicker API — Camera and gallery image capture

JSON Dataset — Structured species dataset converted from research spreadsheets

State-driven UI — Dynamic rendering based on user interaction and match results

This project demonstrates the ability to combine real device input, structured data, and dynamic UI behavior into a functional system.

✅ Current Features (Working Prototype)

This is not a mockup — all features below are fully implemented:

Capture images using device camera

Select images from device gallery

Live image preview after selection

End-to-end submission flow

Real bark matching logic using local image dataset

Dynamic results screen populated from structured dataset

Confidence indicator and alternate match suggestions

Expandable result sections (Show More / Show Less)

Dataset metadata displayed in UI (Missouri v1.0 — 54 species, 260 images)

User feedback for low-quality or invalid images

This confirms that the full technical pipeline (input → processing → structured output → UI) is operational.

📂 Project Structure Overview
app/        → Application screens and routing  
components/ → Reusable UI components  
data/       → JSON dataset and structured species data  
hooks/      → Custom hooks for state/theme logic  
constants/  → App-wide configuration  
scripts/    → Dataset processing utilities  
utils/      → Matching logic and processing helpers  

📌 Development Status

This repository represents the Proof of Concept milestone.

Planned future development includes:

Improved matching accuracy

Machine learning model integration

Dataset expansion (self-collected bark images)

Offline caching

Performance optimizations

UX refinement

Branding and production builds

📋 Project Management & Documentation

All development planning, artifacts, and workflow are tracked using Trello to demonstrate structured project management.

The board includes:

Feature planning

Technology documentation

Research references

Assignment artifacts

UX decisions and rationale

Problems encountered and solved

📎 Notes on Assets

Large binary datasets (such as bark image libraries) are intentionally excluded from this repository to keep the project lightweight and focused on code evaluation.

All datasets used for development are maintained locally.

✍️ Author

N.A. Keilholz
Computer Engineering — Full Sail University
Project & Portfolio IV (AI Concentration)