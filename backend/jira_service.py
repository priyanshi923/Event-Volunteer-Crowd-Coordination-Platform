import os
import requests
import base64
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

# Search for .env files automatically
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

class JiraService:
    def __init__(self):
        self.reload_config()

    def reload_config(self):
        self.base_url = os.environ.get("JIRA_BASE_URL", "").rstrip("/")
        self.email = os.environ.get("JIRA_USER_EMAIL", "") or os.environ.get("JIRA_EMAIL", "")
        self.api_token = os.environ.get("JIRA_API_TOKEN", "")
        self.project_key = os.environ.get("JIRA_PROJECT_KEY", "EVCP")
        self.enabled = bool(self.base_url and self.email and self.api_token)

    def _get_headers(self) -> Dict[str, str]:
        auth_string = f"{self.email}:{self.api_token}"
        auth_base64 = base64.b64encode(auth_string.encode()).decode()
        return {
            "Authorization": f"Basic {auth_base64}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

    def verify_access(self) -> bool:
        if not self.enabled:
            return False
        url = f"{self.base_url}/rest/api/3/project/{self.project_key}"
        try:
            response = requests.get(url, headers=self._get_headers(), timeout=10)
            return response.status_code == 200
        except Exception as e:
            print(f"Jira API verification error: {e}")
            return False

    def get_issue_url(self, issue_key: str) -> Optional[str]:
        if not self.base_url or not issue_key:
            return None
        return f"{self.base_url}/browse/{issue_key}"

    def create_issue(self, title: str, description: str, priority: str = "MEDIUM", task_type: str = "Task") -> Optional[Dict[str, Any]]:
        """Create a Jira issue in project EVCP and return its key and ID."""
        if not self.enabled:
            return None
            
        url = f"{self.base_url}/rest/api/3/issue"
        
        # Default Jira Cloud priorities: 1: Highest, 2: High, 3: Medium, 4: Low, 5: Lowest
        priority_mapping = {
            "CRITICAL": "1",
            "HIGH": "2",
            "MEDIUM": "3",
            "LOW": "4"
        }
        jira_priority_id = priority_mapping.get((priority or "MEDIUM").upper(), "3")
        
        payload = {
            "fields": {
                "project": {
                    "key": self.project_key
                },
                "summary": title,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {
                                    "text": description if description else "Created from EVCP Platform.",
                                    "type": "text"
                                }
                            ]
                        }
                    ]
                },
                "issuetype": {
                    "name": task_type
                },
                "priority": {
                    "id": jira_priority_id
                }
            }
        }

        try:
            response = requests.post(url, headers=self._get_headers(), json=payload, timeout=12)
            if response.status_code == 201:
                return response.json()
            else:
                print(f"Jira API Error (create_issue): {response.status_code} {response.text}")
                return None
        except Exception as e:
            print(f"Jira API Exception (create_issue): {e}")
            return None

    def get_issue(self, issue_key: str) -> Optional[Dict[str, Any]]:
        """Fetch issue details directly from Jira REST API."""
        if not self.enabled or not issue_key:
            return None
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}"
        try:
            response = requests.get(url, headers=self._get_headers(), timeout=10)
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            print(f"Jira API Exception (get_issue): {e}")
            return None

    def get_transitions(self, issue_key: str) -> Optional[Dict[str, Any]]:
        if not self.enabled or not issue_key:
            return None
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}/transitions"
        try:
            response = requests.get(url, headers=self._get_headers(), timeout=10)
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            print(f"Jira API Exception (get_transitions): {e}")
            return None

    def map_evcp_to_jira_status(self, evcp_status: str) -> str:
        s = (evcp_status or "").upper()
        if s in ("OPEN", "TODO", "TO DO", "BACKLOG"):
            return "To Do"
        elif s in ("IN_PROGRESS", "IN PROGRESS"):
            return "In Progress"
        elif s in ("RESOLVED", "DONE", "CLOSED"):
            return "Done"
        return "To Do"

    def map_jira_to_evcp_status(self, jira_status_name: str) -> str:
        s = (jira_status_name or "").upper()
        if "PROGRESS" in s:
            return "IN_PROGRESS"
        elif "DONE" in s or "RESOLV" in s or "CLOSE" in s:
            return "RESOLVED"
        return "OPEN"

    def transition_issue(self, issue_key: str, status: str) -> bool:
        """Transition an issue in Jira based on EVCP status or Jira status name."""
        if not self.enabled or not issue_key:
            return False
            
        target_status_name = self.map_evcp_to_jira_status(status)
        
        transitions_data = self.get_transitions(issue_key)
        if not transitions_data or "transitions" not in transitions_data:
            return False
            
        transition_id = None
        for t in transitions_data["transitions"]:
            target_to_name = t.get("to", {}).get("name", "").lower()
            trans_name = t.get("name", "").lower()
            if target_to_name == target_status_name.lower() or trans_name == target_status_name.lower():
                transition_id = t["id"]
                break
                
        if not transition_id:
            # Check partial matching
            for t in transitions_data["transitions"]:
                target_to_name = t.get("to", {}).get("name", "").lower()
                if target_status_name.lower() in target_to_name:
                    transition_id = t["id"]
                    break

        if not transition_id:
            print(f"No transition found to target status '{target_status_name}' for issue {issue_key}")
            return False
            
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}/transitions"
        payload = {
            "transition": {
                "id": transition_id
            }
        }
        
        try:
            response = requests.post(url, headers=self._get_headers(), json=payload, timeout=10)
            if response.status_code in (200, 204):
                return True
            else:
                print(f"Jira API Error (transition_issue): {response.status_code} {response.text}")
                return False
        except Exception as e:
            print(f"Jira API Exception (transition_issue): {e}")
            return False

jira_service = JiraService()
