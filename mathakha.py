
mark = int(input("Enter your mark: "))

def final_mark(mark):
    
    if mark >= 80:
        return "A"
    elif mark >= 70:
        return "B"
    elif mark >= 60:
        return "C"
    else:
        return "Below C-symbol"

print(final_mark(mark))