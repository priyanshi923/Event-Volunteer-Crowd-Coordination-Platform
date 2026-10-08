import os
import sys
import requests

from jira_service import jira_service

print(f"Jira Service Enabled: {jira_service.enabled}")
print(f"URL: {jira_service.base_url}")
print(f"Project: {jira_service.project_key}")

success = jira_service.verify_access()
print(f"Access Verification: {success}")

if success:
    headers = jira_service._get_headers()
    # Search for an existing issue in project EVCP
    search_url = f"{jira_service.base_url}/rest/api/3/search/jql?jql=project%3D{jira_service.project_key}&maxResults=1"
    r = requests.get(search_url, headers=headers)
    if r.status_code == 200:
        issues = r.json().get("issues", [])
        if issues:
            issue_id = issues[0].get("id")
            issue_data = jira_service.get_issue(issue_id)
            if issue_data:
                key = issue_data.get("key")
                summary = issue_data.get("fields", {}).get("summary")
                status = issue_data.get("fields", {}).get("status", {}).get("name")
                print(f"Verified Issue: {key} - '{summary}' (Status: {status})")
                
                trans = jira_service.get_transitions(key)
                if trans and "transitions" in trans:
                    print(f"Available Transitions for {key}:")
                    for t in trans["transitions"]:
                        print(f"  -> ID: {t.get('id')}, Name: {t.get('name')}, To: {t.get('to', {}).get('name')}")
    else:
        print(f"Search issues notice: {r.status_code}")
