import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Inbox,
  Mail,
  BarChart3,
  Settings,
  Search,
  Bell,
  Plus,
  ChevronDown,
  Clock3,
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000";

const SIMULATED_EMAILS = [
  {
    customer_name: "Aarav Shah",
    customer_email: "aarav@example.com",
    subject: "My order has not arrived",
    message:
      "My package was supposed to arrive two days ago but I still have not received it. Please check the delivery status.",
  },
  {
    customer_name: "Riya Mehta",
    customer_email: "riya@example.com",
    subject: "I was charged twice",
    message:
      "I placed one order but my card was charged twice. Please help me get the extra charge refunded.",
  },
  {
    customer_name: "Kabir Patel",
    customer_email: "kabir@example.com",
    subject: "Cannot log into my account",
    message:
      "I am unable to log into my account even though I am using the correct password.",
  },
  {
    customer_name: "Ananya Rao",
    customer_email: "ananya@example.com",
    subject: "I want to return my product",
    message:
      "The product I received is not what I expected. I would like to return it and get a refund.",
  },
  {
    customer_name: "Vivaan Joshi",
    customer_email: "vivaan@example.com",
    subject: "Payment failed",
    message:
      "I tried placing my order several times but the payment keeps failing at checkout.",
  },
];

function App() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const [agentResponse, setAgentResponse] = useState("");
  const [generatingResponse, setGeneratingResponse] = useState(false);

  const [activePage, setActivePage] = useState("tickets");

  const [simulationRunning, setSimulationRunning] = useState(false);
  const [incomingEmails, setIncomingEmails] = useState([]);
  const [lastSimulatedEmail, setLastSimulatedEmail] = useState(null);

  const [selectedStatus, setSelectedStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API_URL}/tickets`);
      setTickets(response.data);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    }
  };

  const generateAIResponse = async () => {
    if (!selectedTicket) return;

    try {
      setGeneratingResponse(true);

      const response = await axios.post(
        `${API_URL}/tickets/${selectedTicket.ticket_id}/generate-response`
      );

      setAgentResponse(response.data.response || "");

      setSelectedTicket((previous) => ({
        ...previous,
        agent_response: response.data.response || "",
      }));
    } catch (error) {
      console.error("Error generating AI response:", error);

      alert(
        "Unable to generate AI response. Please make sure the FastAPI backend is running."
      );
    } finally {
      setGeneratingResponse(false);
    }
  };

  const simulateIncomingEmail = async () => {
    const email =
      SIMULATED_EMAILS[
        Math.floor(Math.random() * SIMULATED_EMAILS.length)
      ];

    try {
      const response = await axios.post(`${API_URL}/tickets`, {
        customer_name: email.customer_name,
        customer_email: email.customer_email,
        subject: email.subject,
        message: email.message,
      });

      const newTicket = response.data;

      setTickets((previousTickets) => [
        newTicket,
        ...previousTickets,
      ]);

      setIncomingEmails((previousEmails) => [
        {
          ...email,
          ticket_id: newTicket.ticket_id,
          received_at: new Date().toLocaleTimeString(),
        },
        ...previousEmails,
      ]);

      setLastSimulatedEmail(email);

      await fetchTickets();
    } catch (error) {
      console.error("Error creating simulated ticket:", error);

      alert(
        "Unable to create ticket. Please make sure the FastAPI backend is running."
      );
    }
  };

  useEffect(() => {
    let interval;

    if (simulationRunning) {
      interval = setInterval(() => {
        simulateIncomingEmail();
      }, 8000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [simulationRunning]);

  const openTicket = (ticket) => {
    if (!ticket) return;

    setSelectedTicket(ticket);
    setAgentResponse(ticket.agent_response || "");
    setSelectedStatus(ticket.status || "In Progress");
    setActivePage("tickets");
  };

  const updateTicketStatus = async () => {
    if (!selectedTicket || !selectedStatus) return;

    try {
      setUpdatingStatus(true);

      const response = await axios.patch(
        `${API_URL}/tickets/${selectedTicket.ticket_id}`,
        {
          status: selectedStatus,
        }
      );

      const updatedTicket = response.data;

      setSelectedTicket(updatedTicket);
      setSelectedStatus(updatedTicket.status);

      setTickets((previousTickets) =>
        previousTickets.map((ticket) =>
          ticket.ticket_id === updatedTicket.ticket_id
            ? updatedTicket
            : ticket
        )
      );

      if (
        selectedStatus === "Resolved" &&
        updatedTicket.status === "Pending Customer"
      ) {
        alert(
          "Ticket resolved successfully. Resolution email sent to the customer."
        );
      } else {
        alert("Ticket status updated successfully.");
      }

      await fetchTickets();
    } catch (error) {
      console.error("Error updating ticket status:", error);

      alert(
        "Unable to update ticket status. Please make sure the FastAPI backend is running."
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const priorityStyle = (priority) => {
    switch (priority) {
      case "Urgent":
        return "bg-red-100 text-red-700";
      case "High":
        return "bg-orange-100 text-orange-700";
      case "Medium":
        return "bg-yellow-100 text-yellow-700";
      case "Low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-zinc-100 text-zinc-600";
    }
  };

  const statusStyle = (status) => {
    switch (status) {
      case "New":
        return "bg-blue-100 text-blue-700";
      case "In Progress":
        return "bg-purple-100 text-purple-700";
      case "Resolved":
        return "bg-green-100 text-green-700";
      case "Pending Customer":
        return "bg-yellow-100 text-yellow-700";
      case "Closed":
        return "bg-zinc-200 text-zinc-700";
      default:
        return "bg-zinc-100 text-zinc-600";
    }
  };

  const getRouteStyle = (routing) => {
    if (routing === "Auto-Routed") {
      return "bg-green-100 text-green-700";
    }

    if (routing === "Review Recommended") {
      return "bg-yellow-100 text-yellow-700";
    }

    return "bg-red-100 text-red-700";
  };

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-zinc-900">

      {/* SIDEBAR */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-zinc-200 px-5 py-6">

        <div className="flex items-center gap-3 mb-10">
          <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center">
            <Inbox size={19} className="text-white" />
          </div>

          <div>
            <h1 className="font-semibold text-lg">TicketIQ</h1>
            <p className="text-xs text-zinc-400">
              AI Support Router
            </p>
          </div>
        </div>

        <nav className="space-y-2">

          <button
            onClick={() => setActivePage("tickets")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${
              activePage === "tickets"
                ? "bg-zinc-100 font-medium"
                : "text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            <Inbox size={17} />
            Tickets
          </button>

          <button
            onClick={() => setActivePage("inbox")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${
              activePage === "inbox"
                ? "bg-zinc-100 font-medium"
                : "text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            <Mail size={17} />
            Incoming Emails
          </button>

          <button
            onClick={() => setActivePage("dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${
              activePage === "dashboard"
                ? "bg-zinc-100 font-medium"
                : "text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            <BarChart3 size={17} />
            Dashboard
          </button>

          <button
            onClick={() => setActivePage("settings")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${
              activePage === "settings"
                ? "bg-zinc-100 font-medium"
                : "text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            <Settings size={17} />
            Settings
          </button>

        </nav>

        <div className="absolute bottom-6 left-5 right-5">
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">

            <p className="text-xs text-zinc-400 mb-1">
              SYSTEM STATUS
            </p>

            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm">
                AI System Online
              </span>
            </div>

          </div>
        </div>

      </aside>

      {/* MAIN */}
      <main className="ml-64 min-h-screen">

        {/* TOP BAR */}
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8">

          <h2 className="font-semibold">
            {activePage === "tickets"
              ? "Tickets"
              : activePage === "inbox"
              ? "Incoming Emails"
              : activePage === "dashboard"
              ? "Dashboard"
              : "Settings"}
          </h2>

          <div className="flex items-center gap-5">

            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-2.5 text-zinc-400"
              />

              <input
                placeholder="Search"
                className="w-56 bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </div>

            <Bell size={19} className="text-zinc-500" />

            <div className="flex items-center gap-2">

              <div className="w-8 h-8 bg-zinc-200 rounded-full flex items-center justify-center text-sm font-medium">
                A
              </div>

              <ChevronDown
                size={15}
                className="text-zinc-400"
              />

            </div>

          </div>

        </header>

        {/* CONTENT */}
        <div className="p-8">

          {/* TICKETS */}
          {activePage === "tickets" && (
            <div>

              {!selectedTicket ? (
                <>
                  <div className="flex items-center justify-between mb-7">

                    <div>
                      <h2 className="text-2xl font-semibold">
                        Support Tickets
                      </h2>

                      <p className="text-sm text-zinc-500 mt-1">
                        AI-powered customer support management
                      </p>
                    </div>

                    <button
                      onClick={simulateIncomingEmail}
                      className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-800"
                    >
                      <Plus size={16} />
                      Simulate Email
                    </button>

                  </div>

                  {/* SIMULATION */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 mb-6 flex items-center justify-between">

                    <div className="flex items-center gap-3">

                      <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
                        <Clock3 size={17} />
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          Email Simulation
                        </p>

                        <p className="text-xs text-zinc-400">
                          Automatically create test tickets every 8 seconds
                        </p>
                      </div>

                    </div>

                    <button
                      onClick={() =>
                        setSimulationRunning(
                          (previous) => !previous
                        )
                      }
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
                        simulationRunning
                          ? "bg-red-50 text-red-600"
                          : "bg-zinc-900 text-white"
                      }`}
                    >
                      {simulationRunning ? (
                        <>
                          <Square size={14} />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play size={14} />
                          Start
                        </>
                      )}
                    </button>

                  </div>

                  {/* LAST EMAIL */}
                  {lastSimulatedEmail && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-4 mb-6">

                      <div className="flex items-center justify-between">

                        <div>
                          <p className="text-xs text-zinc-400">
                            LAST RECEIVED EMAIL
                          </p>

                          <p className="font-medium mt-1">
                            {lastSimulatedEmail.subject}
                          </p>

                          <p className="text-sm text-zinc-500 mt-1">
                            From{" "}
                            {lastSimulatedEmail.customer_email}
                          </p>
                        </div>

                        <Mail
                          size={20}
                          className="text-zinc-400"
                        />

                      </div>

                    </div>
                  )}

                  {/* TICKET TABLE */}
                  <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">

                    <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">

                      <div>
                        <h3 className="font-medium">
                          All Tickets
                        </h3>

                        <p className="text-xs text-zinc-400 mt-1">
                          {tickets.length} total tickets
                        </p>
                      </div>

                      <button
                        onClick={fetchTickets}
                        className="p-2 rounded-lg hover:bg-zinc-100"
                      >
                        <RefreshCw size={16} />
                      </button>

                    </div>

                    {tickets.length === 0 ? (
                      <div className="p-12 text-center">

                        <Inbox
                          size={30}
                          className="mx-auto text-zinc-300 mb-3"
                        />

                        <p className="text-sm text-zinc-500">
                          No tickets yet
                        </p>

                        <p className="text-xs text-zinc-400 mt-1">
                          Simulate an email to create your first ticket.
                        </p>

                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-100">

                        {tickets.map((ticket) => (
                          <button
                            key={ticket.ticket_id}
                            onClick={() => openTicket(ticket)}
                            className="w-full text-left px-6 py-5 hover:bg-zinc-50 transition"
                          >

                            <div className="flex items-center justify-between gap-5">

                              <div className="min-w-0 flex-1">

                                <div className="flex items-center gap-2 mb-1">

                                  <span className="text-xs text-zinc-400">
                                    {ticket.ticket_id}
                                  </span>

                                  <span
                                    className={`text-xs px-2 py-1 rounded-full ${statusStyle(
                                      ticket.status
                                    )}`}
                                  >
                                    {ticket.status}
                                  </span>

                                </div>

                                <h4 className="font-medium truncate">
                                  {ticket.subject}
                                </h4>

                                <p className="text-sm text-zinc-500 mt-1 truncate">
                                  {ticket.message}
                                </p>

                              </div>

                              <span
                                className={`text-xs px-2.5 py-1.5 rounded-full ${priorityStyle(
                                  ticket.priority
                                )}`}
                              >
                                {ticket.priority}
                              </span>

                            </div>

                          </button>
                        ))}

                      </div>
                    )}

                  </div>
                </>
              ) : (

                /* TICKET DETAIL */
                <div>

                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="text-sm text-zinc-500 hover:text-zinc-900 mb-5"
                  >
                    ← Back to tickets
                  </button>

                  <div className="grid grid-cols-3 gap-6">

                    {/* LEFT */}
                    <div className="col-span-2 space-y-6">

                      {/* HEADER */}
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6">

                        <div className="flex items-start justify-between">

                          <div>

                            <p className="text-xs text-zinc-400 mb-2">
                              {selectedTicket.ticket_id}
                            </p>

                            <h2 className="text-xl font-semibold">
                              {selectedTicket.subject}
                            </h2>

                            <p className="text-sm text-zinc-500 mt-2">
                              From{" "}
                              {selectedTicket.customer_name}{" "}
                              &lt;
                              {selectedTicket.customer_email}
                              &gt;
                            </p>

                          </div>

                          <div className="flex gap-2">

                            <span
                              className={`text-xs px-3 py-1.5 rounded-full ${priorityStyle(
                                selectedTicket.priority
                              )}`}
                            >
                              {selectedTicket.priority}
                            </span>

                            <span
                              className={`text-xs px-3 py-1.5 rounded-full ${statusStyle(
                                selectedTicket.status
                              )}`}
                            >
                              {selectedTicket.status}
                            </span>

                          </div>

                        </div>

                      </div>

                      {/* CUSTOMER MESSAGE */}
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6">

                        <p className="text-xs text-zinc-400 mb-3">
                          CUSTOMER MESSAGE
                        </p>

                        <p className="text-sm leading-6 text-zinc-700">
                          {selectedTicket.message}
                        </p>

                      </div>

                      {/* AI ANALYSIS */}
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6">

                        <p className="text-xs text-zinc-400 mb-4">
                          AI ANALYSIS
                        </p>

                        <div className="grid grid-cols-3 gap-4">

                          <div className="bg-zinc-50 rounded-xl p-4">

                            <p className="text-xs text-zinc-400">
                              CATEGORY
                            </p>

                            <p className="font-medium text-sm mt-2">
                              {selectedTicket.category}
                            </p>

                          </div>

                          <div className="bg-zinc-50 rounded-xl p-4">

                            <p className="text-xs text-zinc-400">
                              CONFIDENCE
                            </p>

                            <p className="font-medium text-sm mt-2">
                              {selectedTicket.category_confidence}%
                            </p>

                          </div>

                          <div className="bg-zinc-50 rounded-xl p-4">

                            <p className="text-xs text-zinc-400">
                              ROUTING
                            </p>

                            <span
                              className={`inline-block text-xs px-2.5 py-1 rounded-full mt-2 ${getRouteStyle(
                                selectedTicket.routing
                              )}`}
                            >
                              {selectedTicket.routing}
                            </span>

                          </div>

                        </div>

                        {selectedTicket.priority_reasons &&
                          selectedTicket.priority_reasons.length > 0 && (
                            <div className="mt-5">

                              <p className="text-xs text-zinc-400 mb-2">
                                PRIORITY REASONS
                              </p>

                              <div className="flex flex-wrap gap-2">

                                {selectedTicket.priority_reasons.map(
                                  (reason, index) => (
                                    <span
                                      key={index}
                                      className="text-xs bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-full"
                                    >
                                      {reason}
                                    </span>
                                  )
                                )}

                              </div>

                            </div>
                          )}

                      </div>

                      {/* STATUS */}
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6">

                        <p className="text-xs text-zinc-400 mb-2">
                          UPDATE TICKET STATUS
                        </p>

                        <div className="flex items-center gap-3">

                          <select
                            value={selectedStatus}
                            onChange={(e) =>
                              setSelectedStatus(e.target.value)
                            }
                            className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm bg-white outline-none focus:border-zinc-400"
                          >
                            <option value="New">
                              New
                            </option>

                            <option value="In Progress">
                              In Progress
                            </option>

                            <option value="Resolved">
                              Resolved
                            </option>

                            <option value="Pending Customer">
                              Pending Customer
                            </option>

                            <option value="Closed">
                              Closed
                            </option>
                          </select>

                          <button
                            onClick={updateTicketStatus}
                            disabled={
                              updatingStatus ||
                              selectedStatus ===
                                selectedTicket.status
                            }
                            className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingStatus
                              ? "Updating..."
                              : "Update Status"}
                          </button>

                        </div>

                        <p className="text-xs text-zinc-400 mt-2">
                          Selecting <strong>Resolved</strong> will
                          automatically send the resolution email to
                          the customer and move the ticket to
                          Pending Customer.
                        </p>

                      </div>

                      {/* PENDING CUSTOMER */}
                      {selectedTicket.status ===
                        "Pending Customer" && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">

                          <div className="flex items-start gap-4">

                            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
                              <Mail
                                size={20}
                                className="text-yellow-700"
                              />
                            </div>

                            <div>

                              <p className="font-semibold text-yellow-900">
                                Awaiting Customer Confirmation
                              </p>

                              <p className="text-sm text-yellow-800 mt-1">
                                The resolution email has been sent to
                                the customer. TicketIQ is waiting for
                                the customer's reply.
                              </p>

                              <p className="text-xs text-yellow-700 mt-3">
                                The ticket will remain open until the
                                customer confirms that the issue has
                                been resolved.
                              </p>

                            </div>

                          </div>

                        </div>
                      )}

                      {/* CLOSED */}
                      {selectedTicket.status === "Closed" && (
                        <div className="bg-green-50 border border-green-200 rounded-2xl p-6">

                          <div className="flex items-center gap-4">

                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                              <CheckCircle2
                                size={20}
                                className="text-green-700"
                              />
                            </div>

                            <div>

                              <p className="font-semibold text-green-900">
                                Ticket Closed
                              </p>

                              <p className="text-sm text-green-800 mt-1">
                                Customer confirmed that the issue has
                                been resolved.
                              </p>

                            </div>

                          </div>

                        </div>
                      )}

                    </div>

                    {/* RIGHT */}
                    <div className="space-y-6">

                      {/* AI RESPONSE */}
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5">

                        <div className="flex items-center justify-between mb-4">

                          <p className="text-xs text-zinc-400">
                            AI RESPONSE
                          </p>

                          <button
                            onClick={generateAIResponse}
                            disabled={generatingResponse}
                            className="text-xs bg-zinc-900 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                          >
                            {generatingResponse
                              ? "Generating..."
                              : "Generate"}
                          </button>

                        </div>

                        <textarea
                          value={agentResponse}
                          onChange={(e) =>
                            setAgentResponse(e.target.value)
                          }
                          placeholder="Generate or write a response..."
                          rows={12}
                          className="w-full border border-zinc-200 rounded-xl p-3 text-sm resize-none outline-none focus:border-zinc-400"
                        />

                        <button
                          className="w-full mt-3 border border-zinc-200 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-50"
                        >
                          Save Response
                        </button>

                      </div>

                      {/* INFO */}
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5">

                        <p className="text-xs text-zinc-400 mb-4">
                          TICKET INFORMATION
                        </p>

                        <div className="space-y-4 text-sm">

                          <div className="flex justify-between">
                            <span className="text-zinc-400">
                              Ticket ID
                            </span>

                            <span className="font-medium">
                              {selectedTicket.ticket_id}
                            </span>
                          </div>

                          <div className="flex justify-between gap-4">
                            <span className="text-zinc-400">
                              Category
                            </span>

                            <span className="font-medium text-right max-w-[180px]">
                              {selectedTicket.category}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-zinc-400">
                              Priority
                            </span>

                            <span className="font-medium">
                              {selectedTicket.priority}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-zinc-400">
                              Status
                            </span>

                            <span className="font-medium">
                              {selectedTicket.status}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-zinc-400">
                              Routing
                            </span>

                            <span className="font-medium">
                              {selectedTicket.routing}
                            </span>
                          </div>

                        </div>

                      </div>

                    </div>

                  </div>

                </div>
              )}

            </div>
          )}

          {/* INBOX */}
          {activePage === "inbox" && (
            <div>

              <div className="flex items-center justify-between mb-7">

                <div>
                  <h2 className="text-2xl font-semibold">
                    Incoming Emails
                  </h2>

                  <p className="text-sm text-zinc-500 mt-1">
                    Simulated customer email inbox
                  </p>
                </div>

                <button
                  onClick={simulateIncomingEmail}
                  className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
                >
                  <Plus size={16} />
                  Receive Email
                </button>

              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">

                {incomingEmails.length === 0 ? (
                  <div className="p-12 text-center">

                    <Mail
                      size={30}
                      className="mx-auto text-zinc-300 mb-3"
                    />

                    <p className="text-sm text-zinc-500">
                      No incoming emails yet.
                    </p>

                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">

                    {incomingEmails.map((email, index) => {

                      const ticket = tickets.find(
                        (item) =>
                          item.ticket_id === email.ticket_id
                      );

                      return (
                        <div
                          key={`${email.ticket_id}-${index}`}
                          className="p-5"
                        >

                          <div className="flex justify-between">

                            <div>

                              <p className="font-medium">
                                {email.subject}
                              </p>

                              <p className="text-sm text-zinc-500 mt-1">
                                {email.customer_name} ·{" "}
                                {email.customer_email}
                              </p>

                            </div>

                            <span className="text-xs text-zinc-400">
                              {email.received_at}
                            </span>

                          </div>

                          <p className="text-sm text-zinc-600 mt-3">
                            {email.message}
                          </p>

                          {ticket && (
                            <button
                              onClick={() => openTicket(ticket)}
                              className="text-xs font-medium mt-4 text-zinc-700 hover:text-black"
                            >
                              Open Ticket →
                            </button>
                          )}

                        </div>
                      );
                    })}

                  </div>
                )}

              </div>

            </div>
          )}

          {/* DASHBOARD */}
          {activePage === "dashboard" && (
            <div>

              <h2 className="text-2xl font-semibold">
                Dashboard
              </h2>

              <p className="text-sm text-zinc-500 mt-1">
                TicketIQ analytics and system overview
              </p>

              <div className="grid grid-cols-4 gap-5 mt-7">

                <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                  <p className="text-xs text-zinc-400">
                    TOTAL TICKETS
                  </p>

                  <p className="text-3xl font-semibold mt-2">
                    {tickets.length}
                  </p>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                  <p className="text-xs text-zinc-400">
                    IN PROGRESS
                  </p>

                  <p className="text-3xl font-semibold mt-2">
                    {
                      tickets.filter(
                        (ticket) =>
                          ticket.status === "In Progress"
                      ).length
                    }
                  </p>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                  <p className="text-xs text-zinc-400">
                    PENDING CUSTOMER
                  </p>

                  <p className="text-3xl font-semibold mt-2">
                    {
                      tickets.filter(
                        (ticket) =>
                          ticket.status === "Pending Customer"
                      ).length
                    }
                  </p>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                  <p className="text-xs text-zinc-400">
                    CLOSED
                  </p>

                  <p className="text-3xl font-semibold mt-2">
                    {
                      tickets.filter(
                        (ticket) =>
                          ticket.status === "Closed"
                      ).length
                    }
                  </p>
                </div>

              </div>

            </div>
          )}

          {/* SETTINGS */}
          {activePage === "settings" && (
            <div>

              <h2 className="text-2xl font-semibold">
                Settings
              </h2>

              <p className="text-sm text-zinc-500 mt-1">
                TicketIQ system configuration
              </p>

              <div className="bg-white border border-zinc-200 rounded-2xl p-6 mt-7 max-w-2xl">

                <p className="text-xs text-zinc-400 mb-4">
                  AI ROUTING CONFIGURATION
                </p>

                <div className="flex items-center justify-between py-3 border-b border-zinc-100">

                  <div>
                    <p className="text-sm font-medium">
                      Automatic Routing
                    </p>

                    <p className="text-xs text-zinc-400 mt-1">
                      Automatically route high-confidence tickets
                    </p>
                  </div>

                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full">
                    Enabled
                  </span>

                </div>

                <div className="flex items-center justify-between py-3">

                  <div>
                    <p className="text-sm font-medium">
                      Confidence Threshold
                    </p>

                    <p className="text-xs text-zinc-400 mt-1">
                      Tickets above 85% confidence are auto-routed
                    </p>
                  </div>

                  <span className="font-medium text-sm">
                    85%
                  </span>

                </div>

              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;