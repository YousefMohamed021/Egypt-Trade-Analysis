from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import psycopg2
import json
import pandas as pd
import glob
import os
from psycopg2.extras import execute_values

DB_CONFIG = {
    "host": "localhost",
    "port": "5432",
    "dbname": "trade_analysis",
    "user": "admin",
    "password": "mysecretpassword"
}

def get_db_connection():
    """Establish connection to PostgreSQL database."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("Database connection established")
        return conn
    except psycopg2.Error as e:
        print(f"Connection failed: {e}")
        return None


def load_world_bank_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        print("Loading World Bank data...")
        
        with open('raw_data/worldbank_indicators_2020-2024.json', 'r') as f:
            world_bank_data = json.load(f)

        df = pd.DataFrame(world_bank_data)
        df['Year'] = df['Year'].astype(int)
        df['Indicator_Value'] = pd.to_numeric(df['Indicator_Value'], errors='coerce')
        print(f"Loaded {len(df)} World Bank records")
        unique_years = df['Year'].unique().tolist()
        unique_indicators = df[['Indicator_Code', 'Description']].drop_duplicates().values.tolist()

        print("Inserting dimension tables...")
        
        # Insert years
        execute_values(cursor,
                       "INSERT INTO dim_date (year_of_trade) VALUES %s ON CONFLICT (year_of_trade) DO NOTHING", 
                       [(year,) for year in unique_years])
        
        # Insert indicators
        execute_values(cursor,
                       "INSERT INTO dim_indicator (indicator_code, indicator_name) VALUES %s ON CONFLICT (indicator_code) DO NOTHING",
                       unique_indicators)
        
        print("Fetching dimension keys...")
        dim_date = pd.read_sql("SELECT date_key, year_of_trade FROM dim_date", conn)
        dim_indicator = pd.read_sql("SELECT indicator_key, indicator_code FROM dim_indicator", conn)
        
        print("Merging data with dimension keys...")
        
        # Merge to get foreign keys
        df = df.merge(dim_date, left_on='Year', right_on='year_of_trade', how='left')
        df = df.merge(dim_indicator, left_on='Indicator_Code', right_on='indicator_code', how='left')
        # Prepare fact table data
        fact_data = df[[
            'indicator_key',
            'date_key',
            'Indicator_Value'
        ]].values.tolist()
        
        print(f"Inserting {len(fact_data)} records into fact_economy...")
        
        # Insert fact table
        execute_values(cursor,
                       """INSERT INTO fact_economy (
                        indicator_key_fk, date_key_fk, indicator_value ) 
                        VALUES %s""",
                        fact_data)
        conn.commit()
        print(f"World Bank data loaded successfully! {len(fact_data)} records inserted into fact_economy.")
        
    except Exception as e:
        conn.rollback()
        print(f"Error loading World Bank data: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def load_uncomtrade_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        file_paths = glob.glob('raw_data/uncomtrade_*.json')
        all_trade_data = []

        for file_path in file_paths:
            with open(file_path, 'r') as f:
                data = json.load(f)
                all_trade_data.extend(data) 

        df = pd.DataFrame(all_trade_data)
        unique_years = df['Year'].unique().tolist()
        unique_commodities = df[['Traded_Commodities']].drop_duplicates().values.tolist()
        flows = df[['Flow_Description']].drop_duplicates().values.tolist()
        unique_countries = df[['Partner_Country', 'Partner_ISO', 'Partner_Code']].drop_duplicates().values.tolist()

        # Insert Traded commodities
        execute_values(cursor,
                       "INSERT INTO dim_commodity (commodity_description) VALUES %s ON CONFLICT (commodity_description) DO NOTHING", 
                       unique_commodities)  

        # Insert flows
        execute_values(cursor,
                       "INSERT INTO dim_flow (flow_description) VALUES %s ON CONFLICT (flow_description) DO NOTHING", 
                       flows)

        # Insert years
        execute_values(cursor,
                       "INSERT INTO dim_date (year_of_trade) VALUES %s ON CONFLICT (year_of_trade) DO NOTHING", 
                       [(year,) for year in unique_years])

        # Insert Partner countries
        execute_values(cursor,
                       "INSERT INTO dim_country (partner_country_name, partner_country_iso, partner_code) VALUES %s ON CONFLICT (partner_country_name) DO NOTHING",
                       unique_countries)
        dim_date = pd.read_sql("SELECT date_key, year_of_trade FROM dim_date", conn)
        dim_country = pd.read_sql("SELECT partner_country_key, partner_country_name FROM dim_country", conn)
        dim_commodity = pd.read_sql("SELECT commodity_key, commodity_description FROM dim_commodity", conn)
        dim_flow = pd.read_sql("SELECT flow_key, flow_description FROM dim_flow", conn)
        
        # Merge to get foreign keys
        df = df.merge(dim_date, left_on='Year', right_on='year_of_trade', how='left')
        df = df.merge(dim_country, left_on='Partner_Country', right_on='partner_country_name', how='left')
        df = df.merge(dim_commodity, left_on='Traded_Commodities', right_on='commodity_description', how='left')
        df = df.merge(dim_flow, left_on='Flow_Description', right_on='flow_description', how='left')
        
        # Prepare fact table data
        fact_data = df[[
            'date_key', 
            'partner_country_key', 
            'commodity_key', 
            'flow_key', 
            'Trade_Value', 
            'WeightofTradedGoods'
        ]].values.tolist()
        
        # Insert fact table
        execute_values(cursor,
                       """INSERT INTO fact_trade 
                          (date_key_fk, partner_country_key_fk, commodity_key_fk, flow_key_fk, trade_value, net_weight) 
                          VALUES %s""",
                       fact_data)
        
        conn.commit()
        print("Data loaded successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"Error loading data: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

default_args = {
    'owner': 'data_team',
    'depends_on_past': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5)
}

with DAG(
    dag_id='data_load',
    default_args=default_args,
    description='Automates UN Comtrade & World Bank data loading to PostgreSQL',
    schedule='@monthly',
    start_date=datetime(2025, 9, 29),
    catchup=False,
    tags=['trade', 'economics', 'etl'],
) as dag:
    
    load_worldbank_task = PythonOperator(
        task_id='load_worldbank_indicators',
        python_callable=load_world_bank_data
    )
    
    load_uncomtrade_task = PythonOperator(
        task_id='load_uncomtrade_data',
        python_callable=load_uncomtrade_data
    )
    
    load_worldbank_task >> load_uncomtrade_task