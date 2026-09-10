from fastapi import FastAPI, HTTPException, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import joblib
import torch
from pathlib import Path
from pydantic import BaseModel
import json
from datetime import datetime
import uuid
from openai import OpenAI
from dotenv import load_dotenv
import os
import re


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL")

openrouter_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY
)


# ============================================================
# APP SETUP
# ============================================================

app = FastAPI(
    title="TicketIQ API",
    description="AI-powered customer support ticket routing system",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# FILE PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = "sanviz/ticketiq-category-model"
TICKETS_FILE = BASE_DIR / "tickets.json"


# ============================================================
# TICKET STORAGE HELPERS
# ============================================================

def load_tickets():
    if not TICKETS_FILE.exists():
        return []

    try:
        with open(TICKETS_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except json.JSONDecodeError:
        return []


def save_tickets(tickets):
    with open(TICKETS_FILE, "w", encoding="utf-8") as file:
        json.dump(
            tickets,
            file,
            indent=4,
            ensure_ascii=False
        )


# ============================================================
# MODEL SETUP
# ============================================================

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_PATH,
    dtype=torch.float16
)

category_encoder = joblib.load(
    "ticketiq_category_model/category_encoder.pkl"
)

model.eval()


# ============================================================
# SENDGRID EMAIL
# ============================================================

def send_email(to_email, subject, body):

    if not SENDGRID_API_KEY:
        print("SendGrid API key is missing.")
        return False

    if not SENDGRID_FROM_EMAIL:
        print("SendGrid sender email is missing.")
        return False

    try:
        message = Mail(
            from_email=SENDGRID_FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            plain_text_content=body
        )

        sg = SendGridAPIClient(SENDGRID_API_KEY)

        response = sg.send(message)

        print(
            f"Email sent to {to_email} | "
            f"status={response.status_code}"
        )

        return 200 <= response.status_code < 300

    except Exception as e:

        print("SendGrid error:", e)

        return False


# ============================================================
# PRIORITY ENGINE
# ============================================================

def calculate_priority(text, category):

    text = text.lower()

    score = 0
    reasons = []

    category_scores = {
        "Account, Security & Login": 25,
        "Payment & Invoicing": 20,
        "Order Modifications & Cancellations": 15,
        "Shipping & Delivery": 15,
        "Returns, Refunds & Exchanges": 10,
        "App, Website & Feedback": 10,
        "Product, Warranty & Tech Specs": 5
    }

    category_score = category_scores.get(category, 0)

    score += category_score

    if category_score > 0:
        reasons.append(f"{category} issue")


    # --------------------------------------------------------
    # CRITICAL SECURITY / FRAUD
    # --------------------------------------------------------

    critical_security = [
        "account compromised",
        "unauthorized access",
        "unauthorized transaction",
        "unauthorized activity",
        "fraud",
        "hacked",
        "stolen credentials",
        "someone accessed my account",
        "someone has access"
    ]

    if any(keyword in text for keyword in critical_security):

        score += 60

        reasons.append(
            "critical security/fraud issue"
        )


    # --------------------------------------------------------
    # FINANCIAL ISSUES
    # --------------------------------------------------------

    financial_issues = [
        "charged twice",
        "duplicate charge",
        "multiple charges",
        "payment deducted",
        "wrong amount charged",
        "overcharged",
        "billing discrepancy",
        "charged more",
        "charged extra",
        "incorrect refund amount",
        "missing refund",
        "refund missing"
    ]

    if any(keyword in text for keyword in financial_issues):

        score += 30

        reasons.append(
            "financial impact"
        )


    # --------------------------------------------------------
    # HIGH CUSTOMER IMPACT
    # --------------------------------------------------------

    high_impact = [
        "cannot log in",
        "can't log in",
        "locked out",
        "cannot access",
        "can't access",
        "payment declined",
        "payment failed",
        "checkout failed",
        "checkout crashing",
        "checkout page",
        "checkout unavailable",
        "cannot complete checkout",
        "unable to complete checkout",
        "cannot place my order",
        "can't place my order",
        "unable to place an order",
        "order missing",
        "package not received",
        "delivered but not received"
    ]

    if any(keyword in text for keyword in high_impact):

        score += 20

        reasons.append(
            "high customer impact"
        )


    # --------------------------------------------------------
    # REFUND DELAY
    # --------------------------------------------------------

    refund_delay = [
        "refund pending",
        "refund delayed",
        "still haven't received my refund",
        "still have not received my refund",
        "refund has not arrived",
        "refund hasn't arrived",
        "waiting for my refund",
        "return was accepted"
    ]

    if any(keyword in text for keyword in refund_delay):

        score += 20

        reasons.append(
            "refund delay"
        )


    # --------------------------------------------------------
    # DELIVERY DELAY
    # --------------------------------------------------------

    delivery_delay = [
        "package delayed",
        "package is delayed",
        "delivery delayed",
        "delivery is delayed",
        "arrived late",
        "arrive late",
        "tracking has not updated",
        "tracking still says in transit",
        "stuck in transit",
        "supposed to arrive",
        "overdue delivery"
    ]

    if any(keyword in text for keyword in delivery_delay):

        score += 15

        reasons.append(
            "delivery delay"
        )


    # --------------------------------------------------------
    # URGENCY
    # --------------------------------------------------------

    urgency_signals = [
        "urgent",
        "immediately",
        "as soon as possible",
        "right away",
        "critical",
        "emergency"
    ]

    if any(keyword in text for keyword in urgency_signals):

        score += 20

        reasons.append(
            "explicit urgency"
        )


    # --------------------------------------------------------
    # DEADLINE / TIME SENSITIVE
    # --------------------------------------------------------

    deadline_signals = [
        "deadline",
        "before tomorrow",
        "by tomorrow",
        "today",
        "before my flight",
        "before my trip",
        "before the event",
        "need it today"
    ]

    if any(keyword in text for keyword in deadline_signals):

        score += 15

        reasons.append(
            "time-sensitive request"
        )


    # --------------------------------------------------------
    # FINAL PRIORITY
    # --------------------------------------------------------

    if score >= 70:

        priority = "Urgent"

    elif score >= 45:

        priority = "High"

    elif score >= 20:

        priority = "Medium"

    else:

        priority = "Low"


    return priority, score, reasons


# ============================================================
# ROUTING ENGINE
# ============================================================

def determine_route(confidence):

    confidence_percent = confidence * 100

    if confidence_percent >= 85:

        return "Auto-Routed"

    elif confidence_percent >= 70:

        return "Review Recommended"

    else:

        return "Agent Review"


# ============================================================
# AI TICKET PREDICTION
# ============================================================

def predict_ticket(text):

    inputs = tokenizer(
        text,
        truncation=True,
        padding=True,
        max_length=128,
        return_tensors="pt"
    )

    inputs = {
        key: value.to(model.device)
        for key, value in inputs.items()
    }

    model.eval()

    with torch.no_grad():

        outputs = model(**inputs)

        probabilities = torch.softmax(
            outputs.logits,
            dim=1
        )

        predicted_id = torch.argmax(
            probabilities,
            dim=1
        ).item()


    category = category_encoder.inverse_transform(
        [predicted_id]
    )[0]

    category_confidence = probabilities[
        0
    ][predicted_id].item()


    priority, priority_score, priority_reasons = calculate_priority(
        text,
        category
    )

    route = determine_route(
        category_confidence
    )


    return {
        "category": category,
        "category_confidence": category_confidence,
        "priority": priority,
        "priority_score": priority_score,
        "priority_reasons": priority_reasons,
        "route": route
    }


# ============================================================
# ANALYSIS WRAPPER
# ============================================================

def analyze_ticket(subject, message):

    subject = subject or ""
    message = message or ""

    text = (
        f"{subject.strip()}. "
        f"{message.strip()}"
    )

    result = predict_ticket(text)

    return {
        "category": result["category"],
        "category_confidence": round(
            result["category_confidence"] * 100,
            2
        ),
        "priority": result["priority"],
        "priority_score": result["priority_score"],
        "priority_reasons": result["priority_reasons"],
        "routing": result["route"]
    }


# ============================================================
# AI CUSTOMER RESPONSE
# ============================================================

def generate_customer_response(ticket):

    prompt = f"""
You are a professional e-commerce customer support agent.

Write a concise, polite and helpful response to the customer.

Ticket ID: {ticket["ticket_id"]}
Category: {ticket["category"]}
Priority: {ticket["priority"]}
Customer message: {ticket["message"]}

Give a useful customer-facing response.

Do not mention:
- AI
- language models
- confidence scores
- routing
- internal systems
- internal processes

Only provide the customer-facing response.
"""

    try:

        response = openrouter_client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional customer support agent."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3
        )

        return response.choices[0].message.content.strip()

    except Exception as e:

        print(
            "Customer response generation error:",
            e
        )

        return (
            "Thank you for contacting TicketIQ Support. "
            "We have received your request and our team "
            "is reviewing it."
        )


# ============================================================
# AUTOMATIC ACKNOWLEDGEMENT
# ============================================================

def generate_acknowledgement(ticket):

    prompt = f"""
You are a professional e-commerce customer support agent.

Write a short, natural and professional acknowledgement email.

Customer name: {ticket["customer_name"]}
Ticket ID: {ticket["ticket_id"]}
Category: {ticket["category"]}
Priority: {ticket["priority"]}

Customer issue:
{ticket["message"]}

Requirements:
- Address the customer by their actual name: {ticket["customer_name"]}
- Use the actual ticket ID: {ticket["ticket_id"]}
- Clearly acknowledge their specific issue.
- Tell them their request is being handled.
- Do not claim that the issue is already resolved.
- Never write [Customer's Name], [Your Name], or any other placeholder.
- Do not use square brackets anywhere in the email.
- Do not mention AI, language models, confidence scores, routing, or internal systems.
- Keep the email concise.
- Write a professional customer-facing email.
- End with "TicketIQ Support Team".

Return ONLY the email body.
"""

    try:

        response = openrouter_client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional e-commerce support agent."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3
        )

        return response.choices[0].message.content.strip()

    except Exception as e:

        print(
            "Acknowledgement generation error:",
            e
        )

        return (
            f"Hello {ticket['customer_name']},\n\n"
            f"Thank you for contacting TicketIQ Support. "
            f"We have received your request regarding "
            f"your {ticket['category'].lower()} issue. "
            f"Your ticket {ticket['ticket_id']} has been created "
            f"and our team is reviewing it.\n\n"
            f"Regards,\n"
            f"TicketIQ Support"
        )


# ============================================================
# RESOLUTION EMAIL
# ============================================================

def generate_resolution_email(ticket):

    prompt = f"""
You are a professional e-commerce customer support agent.

Write a concise, professional customer-facing resolution email.

Customer name: {ticket["customer_name"]}
Ticket ID: {ticket["ticket_id"]}
Category: {ticket["category"]}
Priority: {ticket["priority"]}
Original customer issue:
{ticket["message"]}

The issue has now been resolved.

Tell the customer:
- their issue has been resolved
- their ticket is waiting for their confirmation
- they can reply if the problem is still not fixed

- Address the customer by their actual name: {ticket["customer_name"]}
- Use the actual ticket ID: {ticket["ticket_id"]}
- Never write [Customer's Name], [Your Name], or any other placeholder.
- Do not use square brackets anywhere in the email.
- End with "TicketIQ Support Team".
Do not mention AI, confidence, routing,
or internal systems.

Return only the customer-facing email body.
"""

    try:

        response = openrouter_client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional customer support agent."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3
        )

        return response.choices[0].message.content.strip()

    except Exception as e:

        print(
            "Resolution email generation error:",
            e
        )

        return (
            f"Hello {ticket['customer_name']},\n\n"
            f"Your issue regarding {ticket['category'].lower()} "
            f"has been resolved.\n\n"
            f"Your ticket {ticket['ticket_id']} is now "
            f"waiting for your confirmation.\n\n"
            f"If the issue is still not resolved, simply reply "
            f"to this email and we will continue working on "
            f"the same ticket.\n\n"
            f"Best regards,\n"
            f"TicketIQ Support Team"
        )


# ============================================================
# CUSTOMER REPLY CLASSIFICATION
# ============================================================

def classify_customer_reply(customer_reply):

    prompt = f"""
You are analyzing a customer's reply to a support ticket.

Classify the customer's reply into exactly ONE category.

resolved:
The customer clearly says the issue is fixed, solved,
working, or they are satisfied with the resolution.

not_resolved:
The customer clearly says the issue still exists,
is not fixed, or they need further help.

unclear:
The message does not clearly indicate whether
the issue is resolved.

Customer reply:
{customer_reply}

Return ONLY valid JSON:

{{
    "intent": "resolved"
}}

The intent must be exactly:
resolved
not_resolved
or
unclear
"""

    try:

        response = openrouter_client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You classify customer support replies."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0
        )

        content = response.choices[0].message.content.strip()

        content = (
            content
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )

        result = json.loads(content)

        intent = result.get(
            "intent",
            "unclear"
        )

        if intent not in [
            "resolved",
            "not_resolved",
            "unclear"
        ]:

            intent = "unclear"

        return intent

    except Exception as e:

        print(
            "Customer reply classification error:",
            e
        )

        return "unclear"


# ============================================================
# AUTOMATIC CUSTOMER REPLY
# ============================================================

def generate_customer_reply_response(ticket, intent):

    if intent == "resolved":

        return (
            f"Thank you for confirming that your issue has "
            f"been resolved.\n\n"
            f"Ticket {ticket['ticket_id']} is now closed.\n\n"
            f"If you need any further assistance, please "
            f"contact us again."
        )


    if intent == "not_resolved":

        return (
            f"Thank you for letting us know.\n\n"
            f"We're sorry that the issue is still not resolved. "
            f"Your ticket {ticket['ticket_id']} has been reopened "
            f"and our support team will continue working on the "
            f"same issue.\n\n"
            f"You do not need to create a new ticket."
        )


    return (
        f"Thank you for your reply regarding ticket "
        f"{ticket['ticket_id']}.\n\n"
        f"We've received your message and will review it "
        f"to determine the next steps.\n\n"
        f"Please continue replying to this email so that "
        f"we can keep everything under the same ticket."
    )


# ============================================================
# PYDANTIC MODELS
# ============================================================

class TicketRequest(BaseModel):

    customer_name: str
    customer_email: str
    order_id: str = "N/A"
    subject: str
    message: str


class TicketUpdate(BaseModel):

    status: str | None = None
    category: str | None = None
    priority: str | None = None
    agent_response: str | None = None
    reviewed: bool | None = None


class CustomerConfirmation(BaseModel):

    confirmed: bool


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():

    return {
        "message": "TicketIQ API is running",
        "version": "2.0.0"
    }


# ============================================================
# ANALYZE TICKET
# ============================================================

@app.post("/analyze")
def analyze_ticket_endpoint(
    ticket: TicketRequest
):

    return analyze_ticket(
        ticket.subject,
        ticket.message
    )


# ============================================================
# CREATE TICKET
# ============================================================

@app.post("/tickets")
def create_ticket(
    ticket: TicketRequest
):

    ticket_id = (
        "TKT-"
        + str(uuid.uuid4())[:8].upper()
    )

    analysis = analyze_ticket(
        ticket.subject,
        ticket.message
    )

    new_ticket = {

        "ticket_id": ticket_id,

        "customer_name": ticket.customer_name,

        "customer_email": ticket.customer_email,

        "order_id": ticket.order_id,

        "subject": ticket.subject,

        "message": ticket.message,

        "category": analysis["category"],

        "category_confidence": analysis[
            "category_confidence"
        ],

        "priority": analysis["priority"],

        "priority_score": analysis[
            "priority_score"
        ],

        "priority_reasons": analysis[
            "priority_reasons"
        ],

        "routing": analysis["routing"],

        "status": "New",

        "agent_response": "",

        "customer_confirmed": False,

        "reviewed": (
            analysis["routing"] == "Auto-Routed"
        ),

        "response_sent": False,

        "response_sent_at": None,

        "resolution_email_sent": False,

        "resolution_email_sent_at": None,

        "resolution_response": "",

        "conversation": [
            {
                "sender": "customer",
                "email": ticket.customer_email,
                "message": ticket.message,
                "timestamp": datetime.now().isoformat()
            }
        ],

        "created_at": datetime.now().isoformat()
    }


    tickets = load_tickets()

    tickets.append(new_ticket)

    save_tickets(tickets)


    # --------------------------------------------------------
    # AUTOMATIC RESPONSE FOR HIGH-CONFIDENCE TICKETS
    # --------------------------------------------------------

    if analysis["routing"] == "Auto-Routed":

        acknowledgement = generate_acknowledgement(
            new_ticket
        )

        subject = (
            f"Ticket {ticket_id} Received - TicketIQ Support"
        )

        sent = send_email(
            to_email=ticket.customer_email,
            subject=subject,
            body=acknowledgement
        )

        new_ticket["response_sent"] = sent

        if sent:

            new_ticket["response_sent_at"] = (
                datetime.now().isoformat()
            )

        new_ticket["agent_response"] = acknowledgement

        new_ticket["conversation"].append(
            {
                "sender": "ticketiq",
                "email": SENDGRID_FROM_EMAIL,
                "message": acknowledgement,
                "timestamp": datetime.now().isoformat()
            }
        )

        new_ticket["status"] = "In Progress"

    else:

        # Low confidence ticket goes to agent review.
        new_ticket["status"] = "New"


    save_tickets(tickets)

    return new_ticket


# ============================================================
# GET ALL TICKETS
# ============================================================

@app.get("/tickets")
def get_tickets():

    return load_tickets()


# ============================================================
# GET SINGLE TICKET
# ============================================================

@app.get("/tickets/{ticket_id}")
def get_ticket(
    ticket_id: str
):

    tickets = load_tickets()

    for ticket in tickets:

        if ticket["ticket_id"] == ticket_id:

            return ticket

    raise HTTPException(
        status_code=404,
        detail="Ticket not found"
    )


# ============================================================
# GENERATE AI RESPONSE
# ============================================================

@app.post("/tickets/{ticket_id}/generate-response")
def generate_response_endpoint(
    ticket_id: str
):

    tickets = load_tickets()

    for ticket in tickets:

        if ticket["ticket_id"] == ticket_id:

            response = generate_customer_response(
                ticket
            )

            return {
                "ticket_id": ticket_id,
                "response": response
            }

    raise HTTPException(
        status_code=404,
        detail="Ticket not found"
    )


# ============================================================
# UPDATE TICKET
# ============================================================

@app.patch("/tickets/{ticket_id}")
def update_ticket(
    ticket_id: str,
    update: TicketUpdate
):

    tickets = load_tickets()

    for ticket in tickets:

        if ticket["ticket_id"] != ticket_id:
            continue


        old_status = ticket.get(
            "status",
            "New"
        )


        # ----------------------------------------------------
        # STANDARD UPDATES
        # ----------------------------------------------------

        if update.category is not None:

            ticket["category"] = update.category


        if update.priority is not None:

            ticket["priority"] = update.priority


        if update.agent_response is not None:

            ticket["agent_response"] = update.agent_response

            ticket.setdefault(
                "conversation",
                []
            )

            ticket["conversation"].append(
                {
                    "sender": "agent",
                    "email": SENDGRID_FROM_EMAIL,
                    "message": update.agent_response,
                    "timestamp": datetime.now().isoformat()
                }
            )


        if update.reviewed is not None:

            ticket["reviewed"] = update.reviewed


        # ----------------------------------------------------
        # STATUS UPDATE
        # ----------------------------------------------------

        if update.status is not None:

            ticket["status"] = update.status


        # ----------------------------------------------------
        # RESOLVED → SEND RESOLUTION EMAIL
        # ----------------------------------------------------

        if (
            update.status == "Resolved"
            and old_status != "Resolved"
            and not ticket.get(
                "resolution_email_sent",
                False
            )
        ):

            print(
                f"Ticket {ticket_id} resolved."
            )

            resolution_response = (
                generate_resolution_email(
                    ticket
                )
            )

            resolution_subject = (
                f"Ticket {ticket_id} Has Been Resolved"
            )

            sent = send_email(
                to_email=ticket["customer_email"],
                subject=resolution_subject,
                body=resolution_response
            )

            if sent:

                ticket["resolution_email_sent"] = True

                ticket["resolution_email_sent_at"] = (
                    datetime.now().isoformat()
                )

                ticket["resolution_response"] = (
                    resolution_response
                )

                ticket["status"] = (
                    "Pending Customer"
                )

                ticket["customer_confirmed"] = False

                ticket.setdefault(
                    "conversation",
                    []
                )

                ticket["conversation"].append(
                    {
                        "sender": "ticketiq",
                        "email": SENDGRID_FROM_EMAIL,
                        "message": resolution_response,
                        "timestamp": datetime.now().isoformat()
                    }
                )

            else:

                print(
                    "Resolution email could not be sent."
                )


        # ----------------------------------------------------
        # REOPENING A TICKET
        # ----------------------------------------------------

        if (
            update.status == "In Progress"
            and old_status in [
                "Resolved",
                "Pending Customer",
                "Closed"
            ]
        ):

            ticket["customer_confirmed"] = False

            ticket["resolution_email_sent"] = False

            ticket["resolution_email_sent_at"] = None

            ticket["resolution_response"] = ""


        save_tickets(tickets)

        return ticket


    raise HTTPException(
        status_code=404,
        detail="Ticket not found"
    )


# ============================================================
# LEGACY CUSTOMER CONFIRMATION
# ============================================================

@app.patch("/tickets/{ticket_id}/confirm")
def confirm_ticket(
    ticket_id: str,
    confirmation: CustomerConfirmation
):

    tickets = load_tickets()

    for ticket in tickets:

        if ticket["ticket_id"] == ticket_id:

            if confirmation.confirmed:

                ticket["customer_confirmed"] = True

                ticket["status"] = "Closed"

            save_tickets(tickets)

            return ticket

    raise HTTPException(
        status_code=404,
        detail="Ticket not found"
    )


# ============================================================
# ANALYTICS
# ============================================================

@app.get("/analytics")
def get_analytics():

    tickets = load_tickets()

    total_tickets = len(tickets)

    category_counts = {}

    priority_counts = {}

    status_counts = {}

    routing_counts = {}


    for ticket in tickets:

        category = ticket.get(
            "category",
            "Unknown"
        )

        priority = ticket.get(
            "priority",
            "Unknown"
        )

        status = ticket.get(
            "status",
            "Unknown"
        )

        routing = ticket.get(
            "routing",
            "Unknown"
        )


        category_counts[category] = (
            category_counts.get(category, 0) + 1
        )

        priority_counts[priority] = (
            priority_counts.get(priority, 0) + 1
        )

        status_counts[status] = (
            status_counts.get(status, 0) + 1
        )

        routing_counts[routing] = (
            routing_counts.get(routing, 0) + 1
        )


    return {

        "total_tickets": total_tickets,

        "by_category": category_counts,

        "by_priority": priority_counts,

        "by_status": status_counts,

        "by_routing": routing_counts
    }


# ============================================================
# DUMMY EMAIL INBOX
# ============================================================

@app.post("/inbox/email")
def receive_email(
    ticket: TicketRequest
):

    return create_ticket(ticket)


# ============================================================
# REAL SENDGRID INBOUND EMAIL
# ============================================================

@app.post("/inbound-email")
def inbound_email(
    from_email: str = Form(
        ...,
        alias="from"
    ),
    subject: str = Form(""),
    text: str = Form("")
):

    print(
        "\n========== INCOMING CUSTOMER EMAIL =========="
    )

    print(
        "From:",
        from_email
    )

    print(
        "Subject:",
        subject
    )

    print(
        "Message:",
        text
    )

    print(
        "=============================================\n"
    )


    # ========================================================
    # EXTRACT EMAIL ADDRESS
    # ========================================================

    email_match = re.search(
        r"<([^<>@\s]+@[^<>@\s]+)>",
        from_email
    )

    if email_match:

        actual_email = email_match.group(1)

    else:

        actual_email = from_email.strip()


    # ========================================================
    # FIND TICKET ID
    # ========================================================

    ticket_match = re.search(
        r"TKT-\w+",
        subject.upper()
    )


    tickets = load_tickets()


    # ========================================================
    # EXISTING TICKET REPLY
    # ========================================================

    if ticket_match:

        ticket_id = ticket_match.group(0)

        print(
            "Detected ticket ID:",
            ticket_id
        )


        for ticket in tickets:

            if (
                ticket.get("ticket_id") == ticket_id
                and ticket.get(
                    "customer_email",
                    ""
                ).lower()
                == actual_email.lower()
            ):

                print(
                    "Matched existing ticket:",
                    ticket_id
                )


                # ------------------------------------------------
                # CLASSIFY CUSTOMER REPLY
                # ------------------------------------------------

                intent = classify_customer_reply(
                    text
                )

                print(
                    "Customer reply intent:",
                    intent
                )


                # ------------------------------------------------
                # SAVE CUSTOMER MESSAGE
                # ------------------------------------------------

                ticket.setdefault(
                    "conversation",
                    []
                )

                ticket["conversation"].append(
                    {
                        "sender": "customer",
                        "email": actual_email,
                        "message": text,
                        "timestamp": datetime.now().isoformat()
                    }
                )


                # ------------------------------------------------
                # UPDATE STATUS
                # ------------------------------------------------

                if intent == "resolved":

                    ticket["customer_confirmed"] = True

                    ticket["status"] = "Closed"


                elif intent == "not_resolved":

                    ticket["customer_confirmed"] = False

                    ticket["status"] = "In Progress"

                    # Allow a future resolution email.
                    ticket["resolution_email_sent"] = False

                    ticket["resolution_email_sent_at"] = None

                    ticket["resolution_response"] = ""


                else:

                    ticket["customer_confirmed"] = False

                    ticket["status"] = (
                        "Pending Customer"
                    )

                    ticket["reviewed"] = False


                # ------------------------------------------------
                # AUTOMATIC RESPONSE
                # ------------------------------------------------

                automatic_response = (
                    generate_customer_reply_response(
                        ticket,
                        intent
                    )
                )

                response_subject = (
                    f"Re: Ticket {ticket_id}"
                )

                response_sent = send_email(
                    to_email=actual_email,
                    subject=response_subject,
                    body=automatic_response
                )


                ticket["response_sent"] = response_sent

                if response_sent:

                    ticket["response_sent_at"] = (
                        datetime.now().isoformat()
                    )


                ticket["conversation"].append(
                    {
                        "sender": "ticketiq",
                        "email": SENDGRID_FROM_EMAIL,
                        "message": automatic_response,
                        "timestamp": datetime.now().isoformat()
                    }
                )


                save_tickets(tickets)


                return {
                    "status": "matched",
                    "ticket_id": ticket_id,
                    "customer_email": actual_email,
                    "intent": intent,
                    "new_status": ticket["status"],
                    "response_sent": response_sent
                }


        # Ticket ID existed but ticket/customer did not match.
        return {
            "status": "not_found",
            "ticket_id": ticket_id
        }


    # ========================================================
    # NEW CUSTOMER EMAIL
    # ========================================================

    print(
        "No existing TicketIQ ticket ID found."
    )

    print(
        "Creating a new ticket."
    )


    new_ticket_id = (
        "TKT-"
        + str(uuid.uuid4())[:8].upper()
    )


    analysis = analyze_ticket(
        subject,
        text
    )


    new_ticket = {

        "ticket_id": new_ticket_id,

        "customer_name": actual_email.split("@")[0],

        "customer_email": actual_email,

        "order_id": "N/A",

        "subject": subject,

        "message": text,

        "category": analysis["category"],

        "category_confidence": analysis[
            "category_confidence"
        ],

        "priority": analysis["priority"],

        "priority_score": analysis[
            "priority_score"
        ],

        "priority_reasons": analysis[
            "priority_reasons"
        ],

        "routing": analysis["routing"],

        "status": "New",

        "agent_response": "",

        "customer_confirmed": False,

        "reviewed": (
            analysis["routing"] == "Auto-Routed"
        ),

        "response_sent": False,

        "response_sent_at": None,

        "resolution_email_sent": False,

        "resolution_email_sent_at": None,

        "resolution_response": "",

        "conversation": [
            {
                "sender": "customer",
                "email": actual_email,
                "message": text,
                "timestamp": datetime.now().isoformat()
            }
        ],

        "created_at": datetime.now().isoformat()
    }


    tickets.append(new_ticket)


    # ========================================================
    # AUTOMATIC ACKNOWLEDGEMENT
    # ========================================================

    if analysis["routing"] == "Auto-Routed":

        acknowledgement = generate_acknowledgement(
            new_ticket
        )

        acknowledgement_subject = (
            f"Ticket {new_ticket_id} Received - TicketIQ Support"
        )

        response_sent = send_email(
            to_email=actual_email,
            subject=acknowledgement_subject,
            body=acknowledgement
        )

        new_ticket["response_sent"] = response_sent

        if response_sent:

            new_ticket["response_sent_at"] = (
                datetime.now().isoformat()
            )

        new_ticket["agent_response"] = acknowledgement

        new_ticket["status"] = "In Progress"

        new_ticket["conversation"].append(
            {
                "sender": "ticketiq",
                "email": SENDGRID_FROM_EMAIL,
                "message": acknowledgement,
                "timestamp": datetime.now().isoformat()
            }
        )

    else:

        new_ticket["status"] = "New"

        response_sent = False


    save_tickets(tickets)


    return {
        "status": "created",
        "ticket_id": new_ticket_id,
        "customer_email": actual_email,
        "category": new_ticket["category"],
        "priority": new_ticket["priority"],
        "confidence": new_ticket[
            "category_confidence"
        ],
        "routing": new_ticket["routing"],
        "response_sent": response_sent,
        "new_status": new_ticket["status"]
    }