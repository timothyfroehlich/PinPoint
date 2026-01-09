
from playwright.sync_api import sync_playwright

def verify_filters():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the test page
        try:
            page.goto("http://localhost:3000/test-filters", timeout=60000)

            # Wait for the filters to be visible
            page.wait_for_selector('role=group[name="Filter by status"]')

            # Take a screenshot of the initial state
            page.screenshot(path="verification/initial_state.png")
            print("Initial screenshot taken")

            # Interact with the "Closed" button
            page.get_by_role("button", name="Closed").click()
            page.wait_for_timeout(500) # Wait for potential transition
            page.screenshot(path="verification/closed_active.png")
            print("Closed state screenshot taken")

            # Interact with Severity Select using text locator since label was removed
            # The SelectTrigger usually contains the placeholder "Severity" when no value is selected.
            # But the value could be "all". Let's try finding the button that contains "Severity".

            # Debugging: Print page content if click fails
            try:
                # Try finding by text "Severity"
                severity_trigger = page.get_by_text("Severity", exact=True)
                if severity_trigger.count() > 0:
                   severity_trigger.first.click()
                else:
                   # Try finding by role combobox or button that might contain Severity
                   # Radix UI Select Trigger is a button
                   page.get_by_role("combobox").nth(0).click() # Assuming first combobox is Severity

                page.wait_for_timeout(500) # Wait for dropdown
                page.screenshot(path="verification/severity_open.png")
                print("Severity dropdown screenshot taken")
            except Exception as e:
                print(f"Failed to click severity: {e}")
                page.screenshot(path="verification/debug_severity.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_filters()
