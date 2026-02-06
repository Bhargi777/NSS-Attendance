import csv
import os
import qrcode

CSV_FILE = "roll.csv"
OUTPUT_DIR = "qr_codes"
ROLL_COLUMN = "roll_no"
NAME_COLUMN = "name"

os.makedirs(OUTPUT_DIR, exist_ok=True)

with open(CSV_FILE, newline='', encoding='utf-8') as file:
    reader = csv.DictReader(file)

    for row in reader:
        roll = row[ROLL_COLUMN].strip()
        name = row[NAME_COLUMN].strip()

        if not roll or not name:
            continue

        # Encode BOTH roll and name
        qr_data = f"ROLL={roll};NAME={name}"

        qr = qrcode.QRCode(
            version=2,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        img.save(os.path.join(OUTPUT_DIR, f"{roll}.png"))

        print(f"Generated QR for {roll} - {name}")

print("All QR codes generated successfully.")
