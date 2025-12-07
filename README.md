# Egypt-Trade-Analyzer

An end-to-end Data Engineering project that automates the extraction, transformation, and analysis of Egypt's trade data (UN Comtrade) and economic indicators (World Bank). The insights are served via a modern React dashboard.

📌 Project Overview

This project correlates Egypt's international trade activities (Imports/Exports) with key economic indicators (GDP, Inflation, Debt) to visualize economic trends over time.

Key Features:

ETL Pipeline: Automated extraction from public APIs using Python & Airflow.

Data Warehouse: Star Schema design in PostgreSQL for efficient querying.

Orchestration: Directed Acyclic Graphs (DAGs) manage the Extract -> Load -> Export workflow.

Interactive Dashboard: A React application visualized with Tailwind CSS.

🏗️ Architecture

Extract: Python scripts pull JSON data from UNComtrade & World Bank APIs.
Load: Data is normalized and loaded into a PostgreSQL Schema.
Visualize: The React Frontend consumes the static JSON for fast, responsive analytics.

🚀 Getting Started

Prerequisites:

Docker & Docker Compose
Python 3.10+
Node.js & npm (for the dashboard)

📊 Data Model (Star Schema)

The database uses a Galaxy Schema

Fact Tables:

fact_trade: Trade flow metrics (Value, Weight).
fact_economy: Economic indicators (Value).

Dimensions:

dim_date: Time dimension.
dim_country: Partner country details.
dim_commodity: Product categories.
dim_flow: Trade direction (Import/Export).
dim_indicator: Economic indicator metadata.

🛠️ Tech Stack Details

Backend: Python, Pandas, Psycopg2.
Frontend: React, Vite, Tailwind CSS, Recharts.
DevOps: Docker, Git.