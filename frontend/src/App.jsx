import { useEffect, useState } from "react";
import axios from "axios";
import {
  LayoutDashboard,
  Ticket,
  Mail,
  Settings,
  RefreshCw,
  Search,
  ChevronRight,
  ArrowLeft,
  User,
  Clock,
  Bot,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Send,
  Play,
  Square,
  Plus,
  Inbox,
  BarChart3,
  CircleDot,
  X,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const API_URL = "http://127.0.0.1:8000";

const CATEGORY_OPTIONS = [
  "Account, Security & Login",
  "App, Website & Feedback",
  "Order Modifications & Cancellations",
  "Payment & Invoicing",
  "Product, Warranty & Tech Specs",
  "Returns, Refunds & Exchanges",
  "Shipping & Delivery",
];

const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];

const SIMULATED_EMAILS = [
  {
    customer_name: "Aarav",
    customer_email: "aarav@example.com",
    order_id: "ORD-10021",
    subject: "My package is delayed",
    message:
      "My package was supposed to arrive two days ago but the tracking still says it is in transit. Please check the delivery status.",
  },
  {
    customer_name: "Priya",
    customer_email: "priya@example.com",
    order_id: "ORD-10022",
    subject: "I was charged twice",
    message:
      "I was charged twice for the same order. Please check the duplicate payment and refund the extra charge.",
  },
  {
    customer_name: "Rahul",
    customer_email: "rahul@example.com",
    order_id: "ORD-10023",
    subject: "I cannot login to my account",
    message:
      "I cannot log in to my account even though I am using the correct password. Please help me regain access.",
  },
  {
    customer_name: "Ananya",
    customer_email: "ananya@example.com",
    order_id: "ORD-10024",
    subject: "I want to return my product",
    message:
      "I received the product but I would like to return it. Please tell me how I can start the return process.",
  },
  {
    customer_name: "Rohan",
    customer_email: "rohan@example.com",
    order_id: "ORD-10025",
    subject: "Product information",
    message:
      "Can you provide more information about this product and its warranty coverage?",
  },
];

function App() {
  const [activePage, setActivePage] = useState("dashboard");

  const [tickets, setTickets] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  const [selectedTicket, setSelectedTicket] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [agentResponse, setAgentResponse] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const [reviewCategory, setReviewCategory] = useState("");
  const [reviewPriority, setReviewPriority] = useState("");

  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationIndex, setSimulationIndex] = useState(0);
  const [lastIncomingEmail, setLastIncomingEmail] = useState(null);

  useEffect(() => {
    fetchTickets();
    fetchAnalytics();
  }, []);

  useEffect(() => {
    if (!simulationRunning) return;

    const interval = setInterval(() => {
      simulateNewEmail();
    }, 15000);

    return () => clearInterval(interval);
  }, [simulationRunning, simulationIndex]);

  const fetchTickets = async () => {
    try {
      setLoading(true);

      const response = await axios.get(`${API_URL}/tickets`);

      setTickets(response.data);
    } catch (error) {
      console.error(error);
      setMessage("Unable to load tickets.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API_URL}/analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const showMessage = (text) => {
    setMessage(text);

    setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  const openTicket = (ticket) => {
    setSelectedTicket(ticket);

    setAgentResponse(ticket.agent_response || "");
    setSelectedStatus(ticket.status || "New");

    setReviewCategory(ticket.category || "");
    setReviewPriority(ticket.priority || "");
  };

  const closeTicketDetail = () => {
    setSelectedTicket(null);
    setAgentResponse("");
  };

  const saveAgentChanges = async () => {
    if (!selectedTicket) return;

    try {
      const isReviewRequired =
        selectedTicket.routing !== "Auto-Routed" &&
        !selectedTicket.reviewed;

      const payload = {
        category: reviewCategory,
        priority: reviewPriority,
        status: selectedStatus,
        agent_response: agentResponse,
        reviewed: isReviewRequired
          ? true
          : selectedTicket.reviewed ?? true,
      };

      const response = await axios.patch(
        `${API_URL}/tickets/${selectedTicket.ticket_id}`,
        payload
      );

      const updatedTicket = response.data;

      setSelectedTicket(updatedTicket);

      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.ticket_id === updatedTicket.ticket_id
            ? updatedTicket
            : ticket
        )
      );

      await fetchAnalytics();

      showMessage("Ticket updated successfully.");
    } catch (error) {
      console.error(error);
      showMessage("Unable to update ticket.");
    }
  };

  const confirmResolution = async () => {
    if (!selectedTicket) return;

    try {
      const response = await axios.patch(
        `${API_URL}/tickets/${selectedTicket.ticket_id}/confirm`,
        {
          confirmed: true,
        }
      );

      const updatedTicket = response.data;

      setSelectedTicket(updatedTicket);

      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.ticket_id === updatedTicket.ticket_id
            ? updatedTicket
            : ticket
        )
      );

      await fetchAnalytics();

      showMessage("Customer confirmation received. Ticket closed.");
    } catch (error) {
      console.error(error);
      showMessage("Unable to confirm ticket.");
    }
  };

  const simulateNewEmail = async () => {
    const email = SIMULATED_EMAILS[simulationIndex];

    try {
      const response = await axios.post(`${API_URL}/tickets`, email);

      const newTicket = response.data;

      setTickets((prev) => [newTicket, ...prev]);

      setLastIncomingEmail(email);

      setSimulationIndex(
        (prev) => (prev + 1) % SIMULATED_EMAILS.length
      );

      await fetchAnalytics();

      showMessage("New dummy customer email received.");
    } catch (error) {
      console.error(error);
      showMessage("Unable to simulate incoming email.");
    }
  };

  const toggleSimulation = () => {
    setSimulationRunning((prev) => !prev);
  };

  const navigateTo = (page) => {
    setActivePage(page);
    setSelectedTicket(null);
  };

  const filteredTickets = tickets.filter((ticket) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      !search ||
      ticket.ticket_id?.toLowerCase().includes(search) ||
      ticket.customer_name?.toLowerCase().includes(search) ||
      ticket.subject?.toLowerCase().includes(search) ||
      ticket.category?.toLowerCase().includes(search);

    const matchesPriority =
      priorityFilter === "All" ||
      ticket.priority === priorityFilter;

    const matchesStatus =
      statusFilter === "All" ||
      ticket.status === statusFilter;

    return matchesSearch && matchesPriority && matchesStatus;
  });

  const getPriorityClass = (priority) => {
    switch (priority) {
      case "Urgent":
        return "bg-red-50 text-red-700 border-red-200";
      case "High":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "Medium":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      default:
        return "bg-green-50 text-green-700 border-green-200";
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Closed":
        return "bg-green-50 text-green-700 border-green-200";
      case "Resolved":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Pending Customer":
      case "Awaiting Customer":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "In Progress":
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const renderSidebar = () => (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center">
            <Bot size={21} />
          </div>

          <div>
            <h1 className="font-bold text-xl text-gray-900">
              TicketIQ
            </h1>
            <p className="text-xs text-gray-500">
              Intelligent Support
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        <SidebarItem
          icon={<LayoutDashboard size={19} />}
          label="Dashboard"
          active={activePage === "dashboard"}
          onClick={() => navigateTo("dashboard")}
        />

        <SidebarItem
          icon={<Ticket size={19} />}
          label="Tickets"
          active={activePage === "tickets"}
          onClick={() => navigateTo("tickets")}
          count={tickets.length}
        />

        <SidebarItem
          icon={<Mail size={19} />}
          label="Incoming Email"
          active={activePage === "incoming"}
          onClick={() => navigateTo("incoming")}
        />

        <SidebarItem
          icon={<Settings size={19} />}
          label="Settings"
          active={activePage === "settings"}
          onClick={() => navigateTo("settings")}
        />
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-green-50">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />

          <div>
            <p className="text-sm font-medium text-gray-800">
              System Online
            </p>
            <p className="text-xs text-gray-500">
              AI services active
            </p>
          </div>
        </div>
      </div>
    </aside>
  );

  const renderHeader = (title, subtitle) => (
    <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">
          {title}
        </h2>

        {subtitle && (
          <p className="text-sm text-gray-500 mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {message && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}
    </header>
  );

  const renderDashboard = () => {
    if (!analytics) {
      return (
        <div className="p-8">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            Loading dashboard...
          </div>
        </div>
      );
    }

    const priorityData = Object.entries(
      analytics.by_priority || {}
    ).map(([name, value]) => ({
      name,
      value,
    }));

    const categoryData = Object.entries(
      analytics.by_category || {}
    ).map(([name, value]) => ({
      name,
      value,
    }));

    const statusData = Object.entries(
      analytics.by_status || {}
    ).map(([name, value]) => ({
      name,
      value,
    }));

    return (
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-4 gap-5">
          <StatCard
            title="Total Tickets"
            value={analytics.total_tickets || 0}
            icon={<Ticket size={20} />}
          />

          <StatCard
            title="Urgent"
            value={analytics.by_priority?.Urgent || 0}
            icon={<AlertCircle size={20} />}
          />

          <StatCard
            title="In Progress"
            value={analytics.by_status?.["In Progress"] || 0}
            icon={<Clock size={20} />}
          />

          <StatCard
            title="Closed"
            value={analytics.by_status?.Closed || 0}
            icon={<CheckCircle2 size={20} />}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <ChartCard title="Tickets by Priority">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Tickets by Category">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {categoryData.map((_, index) => (
                    <Cell key={index} />
                  ))}
                </Pie>

                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Tickets by Status">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    );
  };

  const renderTickets = () => (
    <div className="p-8 space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tickets..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg bg-white"
          >
            <option value="All">All Priorities</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg bg-white"
          >
            <option value="All">All Statuses</option>
            <option>New</option>
            <option>In Progress</option>
            <option>Resolved</option>
            <option>Pending Customer</option>
            <option>Closed</option>
          </select>

          <button
            onClick={() => {
              fetchTickets();
              fetchAnalytics();
            }}
            className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                Support Tickets
              </h3>

              <p className="text-sm text-gray-500 mt-1">
                {filteredTickets.length} tickets
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">
            Loading tickets...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No tickets found.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTickets.map((ticket) => (
              <button
                key={ticket.ticket_id}
                onClick={() => openTicket(ticket)}
                className="w-full text-left px-6 py-5 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Ticket size={18} className="text-gray-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="font-medium text-gray-900 truncate">
                        {ticket.subject}
                      </p>

                      <span
                        className={`px-2.5 py-1 rounded-full text-xs border ${getPriorityClass(
                          ticket.priority
                        )}`}
                      >
                        {ticket.priority}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                      <span>{ticket.ticket_id}</span>
                      <span>•</span>
                      <span>{ticket.customer_name}</span>
                      <span>•</span>
                      <span>{ticket.category}</span>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1.5 rounded-full text-xs border ${getStatusClass(
                      ticket.status
                    )}`}
                  >
                    {ticket.status}
                  </span>

                  <ChevronRight
                    size={18}
                    className="text-gray-400"
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderIncomingEmail = () => (
    <div className="p-8 space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <Mail size={23} className="text-gray-700" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Dummy Email Simulator
              </h3>

              <p className="text-sm text-gray-500 mt-1 max-w-xl">
                Simulate incoming customer emails for demonstration
                and testing of the TicketIQ support workflow.
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              simulationRunning
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-gray-50 border-gray-200 text-gray-600"
            }`}
          >
            <CircleDot size={16} />

            <span className="text-sm font-medium">
              {simulationRunning
                ? "Simulation ON"
                : "Simulation OFF"}
            </span>
          </div>
        </div>

        <div className="mt-7 pt-6 border-t border-gray-100 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">
              Automatic Simulation
            </p>

            <p className="text-sm text-gray-500 mt-1">
              Generates one dummy email every 15 seconds.
            </p>
          </div>

          {simulationRunning ? (
            <button
              onClick={toggleSimulation}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              <Square size={16} />
              Stop Simulation
            </button>
          ) : (
            <button
              onClick={toggleSimulation}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              <Play size={16} />
              Start Simulation
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Manual Test
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Generate exactly one dummy customer email whenever
              you want.
            </p>
          </div>

          <button
            onClick={simulateNewEmail}
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            <Plus size={17} />
            Simulate New Email
          </button>
        </div>

        {lastIncomingEmail && (
          <div className="mt-6 p-5 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2
                size={17}
                className="text-green-600"
              />

              <span className="text-sm font-medium text-green-700">
                Last simulated email
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">From:</span>{" "}
                {lastIncomingEmail.customer_name} (
                {lastIncomingEmail.customer_email})
              </p>

              <p>
                <span className="font-medium">Subject:</span>{" "}
                {lastIncomingEmail.subject}
              </p>

              <p className="text-gray-600">
                {lastIncomingEmail.message}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Inbox size={19} />

            <div>
              <h3 className="font-semibold text-gray-900">
                Recent Incoming Emails
              </h3>

              <p className="text-sm text-gray-500">
                Latest simulated customer messages
              </p>
            </div>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No incoming emails yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tickets.slice(0, 5).map((ticket) => (
              <div
                key={ticket.ticket_id}
                className="px-6 py-4 flex items-center gap-4"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Mail size={16} className="text-gray-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {ticket.subject}
                  </p>

                  <p className="text-sm text-gray-500 mt-1">
                    {ticket.customer_name} • {ticket.customer_email}
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs border ${getStatusClass(
                    ticket.status
                  )}`}
                >
                  Ticket Created
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTicketDetail = () => {
    if (!selectedTicket) return null;

    const confidence = Number(
      selectedTicket.category_confidence || 0
    );

    const isReviewRequired =
      selectedTicket.routing !== "Auto-Routed" &&
      !selectedTicket.reviewed;

    return (
      <div className="p-8">
        <button
          onClick={closeTicketDetail}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={17} />
          Back to Tickets
        </button>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selectedTicket.subject}
                    </h2>

                    <span
                      className={`px-3 py-1 rounded-full text-xs border ${getPriorityClass(
                        selectedTicket.priority
                      )}`}
                    >
                      {selectedTicket.priority}
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 mt-2">
                    {selectedTicket.ticket_id}
                  </p>
                </div>

                <span
                  className={`px-3 py-1.5 rounded-full text-xs border ${getStatusClass(
                    selectedTicket.status
                  )}`}
                >
                  {selectedTicket.status}
                </span>
              </div>

              <div className="mt-7 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Mail size={17} />
                  <h3 className="font-medium text-gray-900">
                    Customer Message
                  </h3>
                </div>

                <div className="bg-gray-50 rounded-xl p-5">
                  <p className="text-gray-700 leading-7 whitespace-pre-wrap">
                    {selectedTicket.message}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Bot size={19} />
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900">
                    AI Analysis
                  </h3>

                  <p className="text-sm text-gray-500">
                    Classification and routing decision
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="border border-gray-200 rounded-xl p-5">
                  <p className="text-sm text-gray-500">
                    Predicted Category
                  </p>

                  <p className="font-semibold text-gray-900 mt-2">
                    {selectedTicket.category}
                  </p>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                      <span>Confidence</span>
                      <span>{confidence.toFixed(2)}%</span>
                    </div>

                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-900 rounded-full"
                        style={{
                          width: `${Math.min(confidence, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-5">
                  <p className="text-sm text-gray-500">
                    Routing Decision
                  </p>

                  <div className="flex items-center gap-2 mt-3">
                    {selectedTicket.routing === "Auto-Routed" ? (
                      <ShieldCheck
                        size={20}
                        className="text-green-600"
                      />
                    ) : (
                      <AlertCircle
                        size={20}
                        className="text-orange-500"
                      />
                    )}

                    <span className="font-semibold text-gray-900">
                      {selectedTicket.routing}
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 mt-3">
                    {selectedTicket.routing === "Auto-Routed"
                      ? "High-confidence ticket automatically routed."
                      : "Agent review is required before final routing."}
                  </p>
                </div>
              </div>

              <div className="mt-5 border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">
                      Priority
                    </p>

                    <p className="font-semibold text-gray-900 mt-1">
                      {selectedTicket.priority}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      Priority Score
                    </p>

                    <p className="font-semibold text-gray-900 mt-1">
                      {selectedTicket.priority_score ?? 0}
                    </p>
                  </div>
                </div>

                {selectedTicket.priority_reasons?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Reasons
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.priority_reasons.map(
                        (reason, index) => (
                          <span
                            key={index}
                            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600"
                          >
                            {reason}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isReviewRequired && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                <div className="flex items-start gap-3 mb-6">
                  <AlertCircle
                    size={20}
                    className="text-orange-600 mt-0.5"
                  />

                  <div>
                    <h3 className="font-semibold text-orange-900">
                      Agent Review Required
                    </h3>

                    <p className="text-sm text-orange-800 mt-1">
                      AI confidence is below the automatic routing
                      threshold. Review and confirm the ticket
                      classification.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="bg-white border border-orange-200 rounded-xl p-5">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      AI Suggested Category
                    </p>

                    <p className="font-medium text-gray-900 mt-2">
                      {selectedTicket.category}
                    </p>

                    <p className="text-xs text-gray-500 mt-2">
                      Confidence: {confidence.toFixed(2)}%
                    </p>

                    <label className="block text-sm font-medium text-gray-700 mt-5 mb-2">
                      Agent Decision
                    </label>

                    <select
                      value={reviewCategory}
                      onChange={(e) =>
                        setReviewCategory(e.target.value)
                      }
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white"
                    >
                      {CATEGORY_OPTIONS.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-white border border-orange-200 rounded-xl p-5">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      AI Suggested Priority
                    </p>

                    <p className="font-medium text-gray-900 mt-2">
                      {selectedTicket.priority}
                    </p>

                    <p className="text-xs text-gray-500 mt-2">
                      Score: {selectedTicket.priority_score ?? 0}
                    </p>

                    <label className="block text-sm font-medium text-gray-700 mt-5 mb-2">
                      Agent Decision
                    </label>

                    <select
                      value={reviewPriority}
                      onChange={(e) =>
                        setReviewPriority(e.target.value)
                      }
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white"
                    >
                      {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority}>{priority}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <p className="text-xs text-orange-800">
                    Saving this decision marks the ticket as reviewed.
                  </p>

                  <button
                    onClick={saveAgentChanges}
                    className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                  >
                    Save Agent Decision
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <Send size={19} />

                <div>
                  <h3 className="font-semibold text-gray-900">
                    Agent Response
                  </h3>

                  <p className="text-sm text-gray-500">
                    Respond to the customer and update the ticket
                  </p>
                </div>
              </div>

              <textarea
                value={agentResponse}
                onChange={(e) =>
                  setAgentResponse(e.target.value)
                }
                placeholder="Write your response to the customer..."
                rows={5}
                className="w-full border border-gray-200 rounded-xl p-4 resize-none outline-none focus:ring-2 focus:ring-gray-200"
              />

              <div className="flex items-center justify-between mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ticket Status
                  </label>

                  <select
                    value={selectedStatus}
                    onChange={(e) =>
                      setSelectedStatus(e.target.value)
                    }
                    className="px-4 py-2.5 border border-gray-200 rounded-lg bg-white"
                  >
                    <option>New</option>
                    <option>In Progress</option>
                    <option>Resolved</option>
                    <option>Pending Customer</option>
                    <option>Closed</option>
                  </select>
                </div>

                <button
                  onClick={saveAgentChanges}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  <CheckCircle2 size={17} />
                  Save Changes
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-5">
                Customer Details
              </h3>

              <div className="space-y-5">
                <InfoRow
                  icon={<User size={17} />}
                  label="Customer"
                  value={selectedTicket.customer_name}
                />

                <InfoRow
                  icon={<Mail size={17} />}
                  label="Email"
                  value={selectedTicket.customer_email}
                />

                <InfoRow
                  icon={<Ticket size={17} />}
                  label="Order ID"
                  value={selectedTicket.order_id}
                />

                <InfoRow
                  icon={<Clock size={17} />}
                  label="Created"
                  value={
                    selectedTicket.created_at
                      ? new Date(
                          selectedTicket.created_at
                        ).toLocaleString()
                      : "—"
                  }
                />
              </div>
            </div>

            {selectedTicket.status === "Pending Customer" ||
            selectedTicket.status === "Awaiting Customer" ? (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    size={21}
                    className="text-purple-600 mt-0.5"
                  />

                  <div>
                    <h3 className="font-semibold text-purple-900">
                      Awaiting Customer Confirmation
                    </h3>

                    <p className="text-sm text-purple-800 mt-2 leading-6">
                      The agent has resolved the issue. The ticket
                      can be closed after the customer confirms
                      that the issue has been resolved.
                    </p>
                  </div>
                </div>

                <button
                  onClick={confirmResolution}
                  className="w-full mt-5 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  Simulate Customer Confirmation
                </button>
              </div>
            ) : null}

            {selectedTicket.status === "Closed" &&
            selectedTicket.customer_confirmed ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2
                    size={22}
                    className="text-green-600"
                  />

                  <div>
                    <h3 className="font-semibold text-green-900">
                      Ticket Closed
                    </h3>

                    <p className="text-sm text-green-800 mt-1">
                      Customer confirmation received.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="p-8">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <Settings size={20} />

          <div>
            <h3 className="font-semibold text-gray-900">
              TicketIQ Settings
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              System configuration and project information.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-500">AI Model</p>
            <p className="font-medium mt-1">
              DistilBERT
            </p>
          </div>

          <div className="border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-500">Backend</p>
            <p className="font-medium mt-1">
              FastAPI
            </p>
          </div>

          <div className="border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-500">Frontend</p>
            <p className="font-medium mt-1">
              React + Vite
            </p>
          </div>

          <div className="border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-500">Routing</p>
            <p className="font-medium mt-1">
              Confidence-Based
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  let pageTitle = "Dashboard";
  let pageSubtitle = "Overview of your customer support operations.";

  if (activePage === "tickets") {
    pageTitle = "Tickets";
    pageSubtitle =
      "Manage, review and resolve customer support tickets.";
  }

  if (activePage === "incoming") {
    pageTitle = "Incoming Email";
    pageSubtitle =
      "Simulate customer emails and create support tickets.";
  }

  if (activePage === "settings") {
    pageTitle = "Settings";
    pageSubtitle = "TicketIQ system configuration.";
  }

  return (
    <div className="min-h-screen bg-[#f7f7f6] text-gray-900 flex">
      {renderSidebar()}

      <div className="flex-1 min-w-0">
        {renderHeader(pageTitle, pageSubtitle)}

        {selectedTicket ? (
          renderTicketDetail()
        ) : activePage === "dashboard" ? (
          renderDashboard()
        ) : activePage === "tickets" ? (
          renderTickets()
        ) : activePage === "incoming" ? (
          renderIncomingEmail()
        ) : (
          renderSettings()
        )}
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
  count,
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition ${
        active
          ? "bg-gray-900 text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {icon}

      <span className="flex-1 text-left">{label}</span>

      {count !== undefined && (
        <span
          className={`text-xs ${
            active ? "text-gray-300" : "text-gray-400"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>

          <p className="text-2xl font-semibold text-gray-900 mt-2">
            {value}
          </p>
        </div>

        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="font-semibold text-gray-900 mb-5">
        {title}
      </h3>

      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>

        <p className="text-sm font-medium text-gray-900 mt-1 break-words">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

export default App;