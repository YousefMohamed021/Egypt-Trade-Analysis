from datetime import datetime, timedelta
from airflow.providers.standard.operators.python import PythonOperator
from airflow import DAG
import requests, json, time, os

def fetch_uncomtrade_data(flow_code, flow_name, start_year=2020, end_year=2024):
    headers = {"Ocp-Apim-Subscription-Key": "0111bba81dba4693a82c31dcb7c4490a"}
    os.makedirs("raw_data", exist_ok=True)

    for year in range(start_year, end_year + 1):
        url = "https://comtradeapi.un.org/data/v1/get/C/A/HS"
        params = {
            "reporterCode": "818",
            "period": year,
            "cmdCode": "ALL",
            "flowCode": flow_code,
            "includeDesc": "true"
        }
        response = requests.get(url, headers=headers, params=params)
        data = response.json()

        filtered_data = [
            {
                "Year": item["refYear"],
                "Flow_Description": item["flowDesc"],
                "Partner_Code": item["partnerCode"],
                "Partner_ISO": item["partnerISO"],
                "Partner_Country": item["partnerDesc"],
                "Traded_Commodities": item["cmdDesc"],
                "Trade_Value": item["primaryValue"],
                "WeightofTradedGoods": item.get("grossWgt")
            }
            for item in data["data"]
        ]

        output_path = f"raw_data/uncomtrade_{flow_name}_{year}.json"
        with open(output_path, "w") as f:
            json.dump(filtered_data, f, indent=2)

        print(f"Saved {flow_name} data for {year}")
        time.sleep(2)

def fetch_worldbank_data(start_year=2020, end_year=2024):
    os.makedirs("raw_data", exist_ok=True)
    url = ("https://data360api.worldbank.org/data360/data?"
           "DATABASE_ID=WB_WDI&INDICATOR=WB_WDI_NY_GDP_MKTP_CD,WB_WDI_NY_GDP_MKTP_KD_ZG,"
           "WB_WDI_FP_CPI_TOTL_ZG,WB_WDI_NE_EXP_GNFS_ZS,WB_WDI_NE_IMP_GNFS_ZS,"
           "WB_WDI_DT_DOD_DECT_GN_ZS,WB_WDI_FI_RES_TOTL_MO&REF_AREA=EGY&skip=0")
    response = requests.get(url)
    data = response.json()

    filtered_data = [
        {
            "Year": item["TIME_PERIOD"],
            "Indicator_Code": item["INDICATOR"],
            "Indicator_Value": item["OBS_VALUE"],
            "Description": item["COMMENT_TS"]
        }
        for item in data["value"]
        if start_year <= int(item["TIME_PERIOD"]) <= end_year
    ]

    output_path = "raw_data/worldbank_indicators_2020-2024.json"
    with open(output_path, "w") as f:
        json.dump(filtered_data, f, indent=2)

    print(f"World Bank data saved successfully to {output_path}")



default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="monthly_data_extraction",
    default_args=default_args,
    description="Fetch UN Comtrade and World Bank data daily",
    schedule="@daily",  
    start_date=datetime(2025,9,29),
    catchup=False,
    tags=["data_fetch"],
) as dag:

    fetch_imports = PythonOperator(
        task_id="fetch_uncomtrade_imports",
        python_callable=fetch_uncomtrade_data,
        op_kwargs={"flow_code": "M", "flow_name": "imports"}
    )

    fetch_exports = PythonOperator(
        task_id="fetch_uncomtrade_exports",
        python_callable=fetch_uncomtrade_data,
        op_kwargs={"flow_code": "X", "flow_name": "exports"}
    )

    fetch_worldbank = PythonOperator(
        task_id="fetch_worldbank",
        python_callable=fetch_worldbank_data
    )

    fetch_imports >> fetch_exports >> fetch_worldbank

