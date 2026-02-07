import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "finance.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    # Table for user personality/survey data
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            spending_regret TEXT,
            user_goals TEXT,
            top_categories TEXT, -- JSON list
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Table for transaction metadata (regret scores)
    c.execute('''
        CREATE TABLE IF NOT EXISTS transaction_metadata (
            transaction_id TEXT PRIMARY KEY,
            regret_score INTEGER, -- 0 to 100
            regret_reason TEXT,
            analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Table for Pigeon interventions (geo-behavioral nudges)
    c.execute('''
        CREATE TABLE IF NOT EXISTS pigeon_interventions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            danger_zone_id TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            predicted_probability REAL NOT NULL,
            predicted_score INTEGER NOT NULL, -- 1-100
            risk_level TEXT NOT NULL, -- low/medium/high
            merchant_category TEXT,
            budget_utilization REAL,
            hour_of_day INTEGER,
            notification_sent INTEGER DEFAULT 1, -- boolean
            notification_message TEXT,
            user_response TEXT, -- helpful/not_helpful/ignored
            intervention_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Table for Pigeon user settings
    c.execute('''
        CREATE TABLE IF NOT EXISTS pigeon_user_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1), -- single user
            monitoring_enabled INTEGER DEFAULT 0, -- boolean
            notification_threshold REAL DEFAULT 0.70,
            proximity_radius_meters REAL DEFAULT 50.0,
            quiet_hours_start INTEGER DEFAULT 23, -- hour (0-23)
            quiet_hours_end INTEGER DEFAULT 7, -- hour (0-23)
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

def save_user_profile(spending_regret, user_goals, top_categories):
    conn = get_db_connection()
    c = conn.cursor()
    
    # For this single-user app, we'll just keep one profile row (ID 1)
    # Check if exists
    c.execute("SELECT id FROM user_profile WHERE id = 1")
    exists = c.fetchone()
    
    cat_json = json.dumps(top_categories)
    
    if exists:
        c.execute('''
            UPDATE user_profile 
            SET spending_regret = ?, user_goals = ?, top_categories = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        ''', (spending_regret, user_goals, cat_json))
    else:
        c.execute('''
            INSERT INTO user_profile (id, spending_regret, user_goals, top_categories)
            VALUES (1, ?, ?, ?)
        ''', (spending_regret, user_goals, cat_json))
        
    conn.commit()
    conn.close()

def get_user_profile():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM user_profile WHERE id = 1")
    row = c.fetchone()
    conn.close()
    
    if row:
        return {
            "spending_regret": row["spending_regret"],
            "user_goals": row["user_goals"],
            "top_categories": json.loads(row["top_categories"])
        }
    return None

def get_transaction_metadata(transaction_ids):
    conn = get_db_connection()
    c = conn.cursor()
    
    placeholders = ','.join('?' for _ in transaction_ids)
    query = f"SELECT * FROM transaction_metadata WHERE transaction_id IN ({placeholders})"
    
    c.execute(query, transaction_ids)
    rows = c.fetchall()
    conn.close()
    
    results = {}
    for row in rows:
        results[row["transaction_id"]] = {
            "regret_score": row["regret_score"],
            "regret_reason": row["regret_reason"]
        }
    return results

def save_transaction_regret(transaction_id, score, reason):
    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute('''
        INSERT OR REPLACE INTO transaction_metadata (transaction_id, regret_score, regret_reason, analyzed_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ''', (transaction_id, score, reason))
    
    conn.commit()
    conn.close()

# --- Pigeon Intervention Functions ---

def save_pigeon_intervention(
    danger_zone_id: str,
    latitude: float,
    longitude: float,
    predicted_probability: float,
    predicted_score: int,
    risk_level: str,
    merchant_category: str = None,
    budget_utilization: float = None,
    hour_of_day: int = None,
    notification_sent: bool = True,
    notification_message: str = None
):
    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute('''
        INSERT INTO pigeon_interventions (
            danger_zone_id, latitude, longitude, predicted_probability,
            predicted_score, risk_level, merchant_category, budget_utilization,
            hour_of_day, notification_sent, notification_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        danger_zone_id, latitude, longitude, predicted_probability,
        predicted_score, risk_level, merchant_category, budget_utilization,
        hour_of_day, 1 if notification_sent else 0, notification_message
    ))
    
    conn.commit()
    intervention_id = c.lastrowid
    conn.close()
    return intervention_id

def update_pigeon_intervention_response(intervention_id: int, user_response: str):
    """Update intervention with user feedback (helpful/not_helpful/ignored)"""
    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute('''
        UPDATE pigeon_interventions
        SET user_response = ?
        WHERE id = ?
    ''', (user_response, intervention_id))
    
    conn.commit()
    conn.close()

def get_pigeon_user_settings():
    """Get Pigeon settings for the user (single-user app)"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM pigeon_user_settings WHERE id = 1")
    row = c.fetchone()
    conn.close()
    
    if row:
        return {
            "monitoring_enabled": bool(row["monitoring_enabled"]),
            "notification_threshold": row["notification_threshold"],
            "proximity_radius_meters": row["proximity_radius_meters"],
            "quiet_hours_start": row["quiet_hours_start"],
            "quiet_hours_end": row["quiet_hours_end"],
        }
    # Return defaults if not set
    return {
        "monitoring_enabled": False,
        "notification_threshold": 0.70,
        "proximity_radius_meters": 50.0,
        "quiet_hours_start": 23,
        "quiet_hours_end": 7,
    }

def update_pigeon_user_settings(
    monitoring_enabled: bool = None,
    notification_threshold: float = None,
    proximity_radius_meters: float = None,
    quiet_hours_start: int = None,
    quiet_hours_end: int = None
):
    """Update Pigeon user settings (creates if doesn't exist)"""
    conn = get_db_connection()
    c = conn.cursor()
    
    # Check if exists
    c.execute("SELECT id FROM pigeon_user_settings WHERE id = 1")
    exists = c.fetchone()
    
    if exists:
        # Build dynamic update query
        updates = []
        values = []
        if monitoring_enabled is not None:
            updates.append("monitoring_enabled = ?")
            values.append(1 if monitoring_enabled else 0)
        if notification_threshold is not None:
            updates.append("notification_threshold = ?")
            values.append(notification_threshold)
        if proximity_radius_meters is not None:
            updates.append("proximity_radius_meters = ?")
            values.append(proximity_radius_meters)
        if quiet_hours_start is not None:
            updates.append("quiet_hours_start = ?")
            values.append(quiet_hours_start)
        if quiet_hours_end is not None:
            updates.append("quiet_hours_end = ?")
            values.append(quiet_hours_end)
        
        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            values.append(1)  # WHERE id = 1
            query = f"UPDATE pigeon_user_settings SET {', '.join(updates)} WHERE id = ?"
            c.execute(query, values)
    else:
        # Insert with defaults
        c.execute('''
            INSERT INTO pigeon_user_settings (
                id, monitoring_enabled, notification_threshold,
                proximity_radius_meters, quiet_hours_start, quiet_hours_end
            ) VALUES (1, ?, ?, ?, ?, ?)
        ''', (
            1 if monitoring_enabled else 0,
            notification_threshold or 0.70,
            proximity_radius_meters or 50.0,
            quiet_hours_start if quiet_hours_start is not None else 23,
            quiet_hours_end if quiet_hours_end is not None else 7
        ))
    
    conn.commit()
    conn.close()

# Initialize on module load
init_db()
