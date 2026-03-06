import os

# Folders you want to scan
folders_to_scan = ["./backend", "./frontend"]

# Folders to exclude
excluded_folder_names = ["venv", "node_modules", "__pycache__", ".git"]

# Output file
output_file = "project_export.txt"

# File types to include (adjust if needed)
allowed_extensions = [".py", ".js", ".html", ".css","jsx", ".json", ".md", ".txt","yml", ".yaml", ".csv", ".xml", ".sql", ".java", ".cpp", ".c", ".h", ".go", ".rb", ".php", ".ts", ".tsx", ".sh", ".bat", ".ps1", ".ini", ".conf", ".log", "" ]


with open(output_file, "w", encoding="utf-8") as outfile:

    for root_folder in folders_to_scan:

        for foldername, subfolders, filenames in os.walk(root_folder):

            # Remove excluded folders from traversal
            subfolders[:] = [
                d for d in subfolders if d not in excluded_folder_names
            ]

            for filename in filenames:

                if any(filename.endswith(ext) for ext in allowed_extensions):

                    file_path = os.path.join(foldername, filename)

                    outfile.write("\n" + "=" * 70 + "\n")
                    outfile.write(f"FILE: {file_path}\n")
                    outfile.write("=" * 70 + "\n\n")

                    try:
                        with open(file_path, "r", encoding="utf-8") as infile:
                            outfile.write(infile.read())
                            outfile.write("\n\n")
                    except Exception as e:
                        outfile.write(f"Could not read file: {e}\n\n")

print("Export complete.")