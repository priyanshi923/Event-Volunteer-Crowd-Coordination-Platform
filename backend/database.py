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
        except Exception as e:
            print("Schema migration note:", e)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
