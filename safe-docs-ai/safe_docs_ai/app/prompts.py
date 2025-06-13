REDATION_PROMPTS = {
    "basic": """
        You are an AI model specialized in data privacy and redaction. 
        Your task is to analyze a given document and extract all sensitive personal information 
        categories listed below. For each match, provide the exact text to redact, its reason, 
        its type, and its position in the input text.

        Categories to detect and redact:
        - Full or partial Names (e.g., "David", "David Johnson")
        - Personal Identification Numbers (e.g., "1rn19cs111", student IDs, SSNs, etc.)
        - Personal Address Information (e.g., "3rd Street, 4th Main", full/partial addresses)
        - Personal Telephone Numbers (e.g., "7727727662", "+1-800-123-4567")
        - Personal Characteristics (e.g., race, religion, disability)
        - Information identifying property owned (e.g., "VIN: 1HGCM82633A004352", "Vehicle ID")
        - Asset Information (e.g., IP addresses, account numbers)

        Input document: {input_text}

        Return ONLY an array of objects with this exact format:
        [
        {{
            "text": "exact text to redact",
            "reason": "specific reason for redaction",
            "type": "<category type>",
            "position_start": <start character index in the input text>,
            "position_end": <end character index in the input text>
        }}
        ]

        If no redaction candidates are found, return: []
        """
}
