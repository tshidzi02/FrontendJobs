// =============================================================================
// FILE: frontend/src/context/SidebarContext.jsx
// =============================================================================
// PURPOSE: Shares the sidebar open/closed state across ALL components.
//
// THE PROBLEM IT SOLVES:
//   The Navbar needs a button to OPEN the sidebar.
//   The DashboardLayout needs to KNOW if it's open to show/hide.
//   These two components are far apart in the tree — they don't share a parent
//   that can pass props between them easily.
//
// THE SOLUTION — React Context:
//   Context is a way to share state globally without passing props at every level.
//   Think of it like a "radio station":
//     - SidebarProvider   → the radio transmitter (holds the state)
//     - useSidebar()      → any component can "tune in" and read/change the state
//
// FLOW:
//   1. main.jsx or App.jsx wraps the app in <SidebarProvider>
//   2. Navbar "tunes in" → reads isSidebarOpen, calls toggleSidebar on button click
//   3. DashboardLayout "tunes in" → reads isSidebarOpen to show/hide the drawer
// =============================================================================

import { createContext, useContext, useState } from "react";
// createContext → creates a new Context object. Like creating the "radio station".
// useContext    → lets any component "tune in" to a context.
// useState      → manages the open/closed boolean state.

const SidebarContext = createContext();
// Creates the context object.
// SidebarContext.Provider → the component that "broadcasts" the value.
// useContext(SidebarContext) → reads the broadcasted value from any component.

export function SidebarProvider({ children }) {
  // This component WRAPS the app and provides the sidebar state to everything inside.

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // isSidebarOpen: true = sidebar drawer is visible, false = hidden.
  // Starts closed (false) — sidebar is hidden by default.

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  // Flips the boolean: true → false, false → true.
  // prev is the previous state value — safer than using isSidebarOpen directly
  // because React state updates can be batched/async.

  const closeSidebar = () => setIsSidebarOpen(false);
  // Explicitly closes the sidebar.
  // Called when user clicks a nav link (navigate away → close drawer).

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar, closeSidebar }}>
      {/* value={...} is what gets "broadcasted" to all children.
          Any component that calls useSidebar() receives this object.
          { isSidebarOpen, toggleSidebar, closeSidebar } */}
      {children}
      {/* children = everything wrapped inside <SidebarProvider> in App.jsx */}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  // Custom hook — a convenience wrapper around useContext(SidebarContext).
  // Components import and call useSidebar() instead of useContext(SidebarContext).
  // Cleaner, and gives a better error if used outside the provider.
  return useContext(SidebarContext);
}