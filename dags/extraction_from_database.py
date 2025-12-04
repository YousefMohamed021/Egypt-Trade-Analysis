import pandas as pd
from sqlalchemy import create_engine, text
import os
import json
import numpy as np

db_config = {
    "user": "admin",
    "password": "mysecretpassword",
    "host": "localhost",
    "port": "5432",
    "database": "trade_analysis"
}

connection_str = f"postgresql+psycopg2://{db_config['user']}:{db_config['password']}@{db_config['host']}:{db_config['port']}/{db_config['database']}"
engine = create_engine(connection_str)

query_trade = """
SELECT 
    d.year_of_trade,
    c.partner_country_name,
    c.partner_country_iso,
    comm.commodity_description,
    f.flow_description,
    ft.trade_value,
    ft.net_weight
FROM 
    fact_trade ft
JOIN dim_date d ON ft.date_key_fk = d.date_key
JOIN dim_country c ON ft.partner_country_key_fk = c.partner_country_key
JOIN dim_commodity comm ON ft.commodity_key_fk = comm.commodity_key
JOIN dim_flow f ON ft.flow_key_fk = f.flow_key; 
"""

with engine.connect() as conn:
    df = pd.read_sql(text(query_trade), conn)

df['trade_value'] = pd.to_numeric(df['trade_value'], errors='coerce').fillna(0)
df['year'] = df['year_of_trade']

def get_region(country):
    mena = ["Turkey", "Saudi Arabia", "United Arab Emirates", "Libya", "Jordan", "Egypt"]
    europe = ["Italy", "Germany", "Spain", "United Kingdom", "France", "Russia", "Ukraine"]
    americas = ["USA", "Canada", "Brazil"]
    asia = ["China", "India", "South Korea", "Japan"]
    
    if country in mena: return "MENA"
    if country in europe: return "Europe"
    if country in americas: return "Americas"
    if country in asia: return "Asia"
    return "International"

df['region'] = df['partner_country_name'].apply(get_region)

final_output = {
    "trends": [],
    "yearly_data": {},
    "raw_sample": []
}

trend_df = df.groupby(['year', 'flow_description'])['trade_value'].sum().unstack(fill_value=0).reset_index()
trend_df.columns.name = None
trend_df = trend_df.rename(columns={'Export': 'exports', 'Import': 'imports'})
final_output['trends'] = trend_df.to_dict(orient='records')

unique_years = sorted(df['year'].unique())

for year in unique_years:
    year_df = df[df['year'] == year]
    
    exports = year_df[year_df['flow_description'] == 'Export']['trade_value'].sum()
    imports = year_df[year_df['flow_description'] == 'Import']['trade_value'].sum()

    partners_df = year_df.groupby('partner_country_name')[['trade_value']].sum()
    partners_df = partners_df.sort_values('trade_value', ascending=False).head(10).reset_index()
    partners_df = partners_df.rename(columns={'partner_country_name': 'name', 'trade_value': 'value'})

    p_split = year_df.groupby(['partner_country_name', 'flow_description'])['trade_value'].sum().unstack(fill_value=0)
    p_split['total'] = p_split.get('Export', 0) + p_split.get('Import', 0)
    p_split = p_split.sort_values('total', ascending=False).head(10).reset_index()
    p_formatted = []
    for _, row in p_split.iterrows():
        p_formatted.append({
            "name": row['partner_country_name'],
            "exports": row.get('Export', 0),
            "imports": row.get('Import', 0)
        })

    comm_df = year_df.groupby('commodity_description')['trade_value'].sum().reset_index()
    comm_df = comm_df.sort_values('trade_value', ascending=False)
    
    comm_df['name'] = comm_df['commodity_description'].astype(str).str.split(';').str[0].str.replace(r'^\d+\s*-\s*', '', regex=True)
    
    top10_comm = comm_df.head(10)[['name', 'trade_value']].rename(columns={'trade_value': 'value'}).to_dict(orient='records')
    treemap_comm = comm_df.head(30)[['name', 'trade_value']].rename(columns={'trade_value': 'size'}).to_dict(orient='records')

    reg_df = year_df.groupby(['region', 'flow_description'])['trade_value'].sum().unstack(fill_value=0).reset_index()
    reg_formatted = []
    for _, row in reg_df.iterrows():
        reg_formatted.append({
            "name": row['region'],
            "exports": row.get('Export', 0),
            "imports": row.get('Import', 0)
        })
    final_output["yearly_data"][int(year)] = {
        "kpi": {
            "exports": exports,
            "imports": imports,
            "net": exports - imports
        },
        "partners": p_formatted,
        "commodities": {
            "top10": top10_comm,
            "all": treemap_comm
        },
        "regions": reg_formatted
    }

raw_sample = df.head(500).copy()
raw_sample = raw_sample.rename(columns={
    'year_of_trade': 'Year',
    'flow_description': 'Flow',
    'partner_country_name': 'Partner',
    'commodity_description': 'Commodity',
    'trade_value': 'Value'
})
final_output['raw_sample'] = raw_sample[['Year', 'Flow', 'Partner', 'Commodity', 'Value']].to_dict(orient='records')

public_folder = r'D:\Desktop\Egypt-Trade-Analysis\my-dashboard-app\public'
output_file = os.path.join(public_folder, 'dashboard_precomputed.json')

class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer): return int(obj)
        if isinstance(obj, np.floating): return float(obj)
        if isinstance(obj, np.ndarray): return obj.tolist()
        return super(NpEncoder, self).default(obj)

with open(output_file, 'w') as f:
    json.dump(final_output, f, cls=NpEncoder)