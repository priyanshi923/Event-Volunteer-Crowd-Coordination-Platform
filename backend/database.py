from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./event_platform.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def init_db():
    Base.metadata.create_all(bind=engine)
    # Ensure missing columns in existing SQLite tables are added seamlessly
    with engine.connect() as conn:
        try:
            cursor = conn.exec_driver_sql("PRAGMA table_info(volunteers)")
            cols = [row[1] for row in cursor.fetchall()]
            if cols and "preferences" not in cols:
                conn.exec_driver_sql("ALTER TABLE volunteers ADD COLUMN preferences VARCHAR(200) DEFAULT ''")
                conn.commit()

            # Normalize legacy task statuses to OPEN, IN_PROGRESS, RESOLVED
            conn.exec_driver_sql("UPDATE tasks SET status = 'OPEN' WHERE status IN ('todo', 'open')")
            conn.exec_driver_sql("UPDATE tasks SET status = 'IN_PROGRESS' WHERE status = 'in_progress'")
            conn.exec_driver_sql("UPDATE tasks SET status = 'RESOLVED' WHERE status IN ('done', 'resolved')")

            # Normalize legacy task priorities to LOW, MEDIUM, HIGH, CRITICAL
            conn.exec_driver_sql("UPDATE tasks SET priority = 'CRITICAL' WHERE priority IN ('Urgent', 'urgent', 'Critical')")
            conn.exec_driver_sql("UPDATE tasks SET priority = 'HIGH' WHERE priority IN ('High', 'high')")
            conn.exec_driver_sql("UPDATE tasks SET priority = 'MEDIUM' WHERE priority IN ('Medium', 'medium')")
            conn.exec_driver_sql("UPDATE tasks SET priority = 'LOW' WHERE priority IN ('Low', 'low')")
            conn.commit()
        except Exception as e:
            print("Schema migration note:", e)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
