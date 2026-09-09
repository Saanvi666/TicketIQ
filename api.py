from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import joblib
import torch
from pathlib import Path
from pydantic import BaseModel
import json
from datetime import datetime
import uuid


# ============================================================
# APP SETUP
# ============================================================

app = FastAPI(
    title="TicketIQ API",
    description="AI-powered customer support ticket routing system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MODEL SETUP
# ============================================================

MODEL_PATH = Path(__file__).resolve().parent / "ticketiq_category_model"

tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_PATH
)

category_encoder = joblib.load(
    MODEL_PATH / "category_encoder.pkl"
)

model.eval()


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
        reasons.append("critical security/fraud issue")


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
        reasons.append("financial impact")


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
        reasons.append("high customer impact")


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
        reasons.append("refund delay")


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
        reasons.append("delivery delay")


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
        reasons.append("explicit urgency")


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
        reasons.append("time-sensitive request")


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
        k: v.to(model.device)
        for k, v in inputs.items()
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
# CLEAN ANALYSIS WRAPPER
# ============================================================

def analyze_ticket(subject, message):

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
# PYDANTIC MODELS
# ============================================================

class TicketRequest(BaseModel):

    customer_name: str
    customer_email: str
    order_id: str
    subject: str
    message: str


class TicketUpdate(BaseModel):

    status: str | None = None
    category: str | None = None
    priority: str | None = None
    agent_response: str | None = None

    # NEW:
    # Stores whether an agent has reviewed
    # a low-confidence ticket.
    reviewed: bool | None = None


class CustomerConfirmation(BaseModel):

    confirmed: bool


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():

    return {
        "message": "TicketIQ API is running"
    }


# ============================================================
# ANALYZE TICKET
# ============================================================

@app.post("/analyze")
def analyze_ticket_endpoint(
    ticket: TicketRequest
):

    result = analyze_ticket(
        ticket.subject,
        ticket.message
    )

    return result


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

        # NEW:
        # Auto-routed tickets do not need
        # agent review.
        "reviewed": (
            analysis["routing"] == "Auto-Routed"
        ),

        "created_at": datetime.now().isoformat()
    }


    with open("tickets.json", "r") as file:

        tickets = json.load(file)


    tickets.append(new_ticket)


    with open("tickets.json", "w") as file:

        json.dump(
            tickets,
            file,
            indent=4
        )


    return new_ticket


# ============================================================
# GET ALL TICKETS
# ============================================================

@app.get("/tickets")
def get_tickets():

    with open("tickets.json", "r") as file:

        tickets = json.load(file)


    return tickets


# ============================================================
# GET SINGLE TICKET
# ============================================================

@app.get("/tickets/{ticket_id}")
def get_ticket(
    ticket_id: str
):

    with open("tickets.json", "r") as file:

        tickets = json.load(file)


    for ticket in tickets:

        if ticket["ticket_id"] == ticket_id:

            return ticket


    return {
        "error": "Ticket not found"
    }


# ============================================================
# UPDATE TICKET
# ============================================================

@app.patch("/tickets/{ticket_id}")
def update_ticket(
    ticket_id: str,
    update: TicketUpdate
):

    with open("tickets.json", "r") as file:

        tickets = json.load(file)


    for ticket in tickets:

        if ticket["ticket_id"] == ticket_id:

            if update.status is not None:

                ticket["status"] = update.status


            if update.category is not None:

                ticket["category"] = update.category


            if update.priority is not None:

                ticket["priority"] = update.priority


            if update.agent_response is not None:

                ticket["agent_response"] = (
                    update.agent_response
                )


            # NEW:
            # Persist agent review state.
            if update.reviewed is not None:

                ticket["reviewed"] = update.reviewed


            with open("tickets.json", "w") as file:

                json.dump(
                    tickets,
                    file,
                    indent=4
                )


            return ticket


    return {
        "error": "Ticket not found"
    }


# ============================================================
# CUSTOMER CONFIRMATION
# ============================================================

@app.patch("/tickets/{ticket_id}/confirm")
def confirm_ticket(
    ticket_id: str,
    confirmation: CustomerConfirmation
):

    with open("tickets.json", "r") as file:

        tickets = json.load(file)


    for ticket in tickets:

        if ticket["ticket_id"] == ticket_id:

            if confirmation.confirmed:

                ticket["customer_confirmed"] = True

                ticket["status"] = "Closed"


            with open("tickets.json", "w") as file:

                json.dump(
                    tickets,
                    file,
                    indent=4
                )


            return ticket


    return {
        "error": "Ticket not found"
    }


# ============================================================
# ANALYTICS
# ============================================================

@app.get("/analytics")
def get_analytics():

    with open("tickets.json", "r") as file:

        tickets = json.load(file)


    total_tickets = len(tickets)

    category_counts = {}

    priority_counts = {}

    status_counts = {}

    routing_counts = {}


    for ticket in tickets:

        category = ticket["category"]

        priority = ticket["priority"]

        status = ticket["status"]

        routing = ticket["routing"]


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