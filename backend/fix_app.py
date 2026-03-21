# Run this from your backend folder:
# python3 fix_app.py

with open("app.py", "r") as f:
    content = f.read()

# The broken version has the if __name__ block indented inside bulk_tex
bad  = "    if __name__ == \"__main__\":\n        app.run(debug=True)"
good = "\nif __name__ == \"__main__\":\n    app.run(debug=True)"

if bad in content:
    content = content.replace(bad, good)
    with open("app.py", "w") as f:
        f.write(content)
    print("✓ Fixed: if __name__ block moved to top level")
else:
    print("⚠ Pattern not found — checking current state...")
    # Show last 10 lines so you can see what's there
    lines = content.splitlines()
    print("Last 10 lines of app.py:")
    for i, line in enumerate(lines[-10:], len(lines)-9):
        print(f"  {i}: {repr(line)}")
