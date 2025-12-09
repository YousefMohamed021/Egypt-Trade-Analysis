# Egypt-Trade-Analyzer

An end-to-end Data Engineering project that automates the extraction, transformation, and analysis of Egypt's trade data (UN Comtrade) and economic indicators (World Bank). The insights are served via a modern React dashboard.

<h2>📌 Project Overview</h2>

This project correlates Egypt's international trade activities (Imports/Exports) with key economic indicators (GDP, Inflation, Debt) to visualize economic trends over time.

<h3>Key Features:</h3>

ETL Pipeline: Automated extraction from public APIs using Python & Airflow.

Data Warehouse: Star Schema design in PostgreSQL for efficient querying.

Orchestration: Directed Acyclic Graphs (DAGs) manage the Extract -> Load -> Export workflow.

Interactive Dashboard: A React application visualized with Tailwind CSS.

<h2>🏗️ Architecture</h2>

* Extract: Python scripts pull JSON data from UNComtrade & World Bank APIs.
* Load: Data is normalized and loaded into a PostgreSQL Schema.
* Visualize: The React Frontend consumes the static JSON for fast, responsive analytics.

<h2>🚀 Getting Started</h2>

<h3>Prerequisites:</h3>

* Docker (for PostgreSQL)
* Python 3.10+
* Node.js & npm (for the dashboard)

<h2>📊 Data Model</h2>

The database uses a Galaxy Schema

<h3>Fact Tables:</h3>

* fact_trade: Stores quantitative measures related to trade transactions.
* fact_economy: Stores quantitative measures for various economic indicators.

<h3>Dimensions:</h3>

* dim_date: Stores time attributes shared by both fact tables.
* dim_country: Stores country attributes shared by both fact tables.
* dim_commodity: Stores commodity attributes.
* dim_flow: Stores trade flow direction attributes (Import/Export).
* dim_indicator: Stores economic indicator attributes.

<h2>🛠️ Tech Stack Details</h2>

* Backend: Python, Pandas, Psycopg2.
* Frontend: React, Vite, Tailwind CSS, Recharts.
* DevOps: Docker, Git.
