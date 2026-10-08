import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./event_platform.db")

# Ensure parent directory exists for SQLite database files if specified
if SQLALCHEMY_DATABASE_URL.startswith("sqlite:///"):
    db_path = SQLALCHEMY_DATABASE_URL.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
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
            # Volunteer statuses are Available, Checked In, Checked Out
            conn.exec_driver_sql("UPDATE volunteers SET status = 'Available' WHERE status IN ('Registered', 'Active') OR status IS NULL")
            conn.commit()

            # Event listing / discovery fields
            ev_cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info(events)").fetchall()]
            if ev_cols:
                if "category" not in ev_cols:
                    conn.exec_driver_sql("ALTER TABLE events ADD COLUMN category VARCHAR(100) DEFAULT ''")
                if "image_url" not in ev_cols:
                    conn.exec_driver_sql("ALTER TABLE events ADD COLUMN image_url VARCHAR(300) DEFAULT ''")
                if "is_featured" not in ev_cols:
                    conn.exec_driver_sql("ALTER TABLE events ADD COLUMN is_featured BOOLEAN DEFAULT 0")
                if "volunteers_needed" not in ev_cols:
                    conn.exec_driver_sql("ALTER TABLE events ADD COLUMN volunteers_needed INTEGER DEFAULT 0")
                conn.commit()

            # Add missing columns to announcements if needed
            cursor_ann = conn.exec_driver_sql("PRAGMA table_info(announcements)")
            ann_cols = [row[1] for row in cursor_ann.fetchall()]
            if ann_cols:
                if "message" not in ann_cols:
                    conn.exec_driver_sql("ALTER TABLE announcements ADD COLUMN message TEXT DEFAULT ''")
                if "target_type" not in ann_cols:
                    conn.exec_driver_sql("ALTER TABLE announcements ADD COLUMN target_type VARCHAR(50) DEFAULT 'EVERYONE'")
                if "target_value" not in ann_cols:
                    conn.exec_driver_sql("ALTER TABLE announcements ADD COLUMN target_value VARCHAR(100) DEFAULT ''")
                # Legacy coordinator-only alerts (ROLE/COORDINATOR) use the COORDINATORS audience
                conn.exec_driver_sql("UPDATE announcements SET target_type = 'COORDINATORS', target_value = '' WHERE target_type = 'ROLE' AND UPPER(target_value) IN ('COORDINATOR', 'COORDINATORS')")
                # Backfill message with content if message is empty
                conn.exec_driver_sql("UPDATE announcements SET message = content WHERE (message IS NULL OR message = '') AND content IS NOT NULL")
                conn.commit()

            # Add missing columns to shifts
            cursor_shifts = conn.exec_driver_sql("PRAGMA table_info(shifts)")
            shift_cols = [row[1] for row in cursor_shifts.fetchall()]
            if shift_cols:
                if "date" not in shift_cols:
                    conn.exec_driver_sql("ALTER TABLE shifts ADD COLUMN date VARCHAR(50) DEFAULT '2026-10-02'")
                if "mandatory_skill" not in shift_cols:
                    conn.exec_driver_sql("ALTER TABLE shifts ADD COLUMN mandatory_skill VARCHAR(100) DEFAULT ''")
                if "optional_skill" not in shift_cols:
                    conn.exec_driver_sql("ALTER TABLE shifts ADD COLUMN optional_skill VARCHAR(100) DEFAULT ''")
                conn.commit()

            # Add missing columns to shift_assignments
            cursor_assign = conn.exec_driver_sql("PRAGMA table_info(shift_assignments)")
            assign_cols = [row[1] for row in cursor_assign.fetchall()]
            if assign_cols:
                if "assignment_status" not in assign_cols:
                    conn.exec_driver_sql("ALTER TABLE shift_assignments ADD COLUMN assignment_status VARCHAR(50) DEFAULT 'ASSIGNED'")
                if "no_show_at" not in assign_cols:
                    conn.exec_driver_sql("ALTER TABLE shift_assignments ADD COLUMN no_show_at DATETIME NULL")
                if "dropout_at" not in assign_cols:
                    conn.exec_driver_sql("ALTER TABLE shift_assignments ADD COLUMN dropout_at DATETIME NULL")
                if "completed_at" not in assign_cols:
                    conn.exec_driver_sql("ALTER TABLE shift_assignments ADD COLUMN completed_at DATETIME NULL")
                
                # Backfill assignment_status from existing status
                conn.exec_driver_sql("UPDATE shift_assignments SET assignment_status = 'COMPLETED' WHERE UPPER(status) = 'COMPLETED'")
                conn.exec_driver_sql("UPDATE shift_assignments SET assignment_status = 'DROPPED_OUT' WHERE UPPER(status) IN ('DROPPED OUT', 'DROPPED_OUT')")
                conn.exec_driver_sql("UPDATE shift_assignments SET assignment_status = 'NO_SHOW' WHERE UPPER(status) = 'NO_SHOW'")
                conn.commit()

            # Add missing columns to issues
            cursor_issues = conn.exec_driver_sql("PRAGMA table_info(issues)")
            issue_cols = [row[1] for row in cursor_issues.fetchall()]
            if issue_cols:
                if "original_assigned_coordinator" not in issue_cols:
                    conn.exec_driver_sql("ALTER TABLE issues ADD COLUMN original_assigned_coordinator VARCHAR(150) NULL")
                if "escalation_level" not in issue_cols:
                    conn.exec_driver_sql("ALTER TABLE issues ADD COLUMN escalation_level INTEGER DEFAULT 0")
                if "escalated_at" not in issue_cols:
                    conn.exec_driver_sql("ALTER TABLE issues ADD COLUMN escalated_at DATETIME NULL")
                conn.exec_driver_sql("UPDATE issues SET original_assigned_coordinator = assigned_coordinator WHERE original_assigned_coordinator IS NULL OR original_assigned_coordinator = ''")
                conn.commit()

            # Add missing columns to tasks
            cursor_tasks = conn.exec_driver_sql("PRAGMA table_info(tasks)")
            task_cols = [row[1] for row in cursor_tasks.fetchall()]
            if task_cols:
                if "jira_issue_key" not in task_cols:
                    conn.exec_driver_sql("ALTER TABLE tasks ADD COLUMN jira_issue_key VARCHAR(50) NULL")
                if "jira_issue_id" not in task_cols:
                    conn.exec_driver_sql("ALTER TABLE tasks ADD COLUMN jira_issue_id VARCHAR(50) NULL")
                if "jira_synced_at" not in task_cols:
                    conn.exec_driver_sql("ALTER TABLE tasks ADD COLUMN jira_synced_at DATETIME NULL")
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
