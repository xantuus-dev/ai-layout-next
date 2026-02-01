"use client";
import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { Home, MessageSquare, FileText, Settings, LogOut, BarChart3 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "next-auth/react";

export function SidebarDemo() {
  const { data: session } = useSession();

  const links = [
    {
      label: "Home",
      href: "/",
      icon: (
        <Home className="text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Workspace",
      href: "/workspace",
      icon: (
        <MessageSquare className="text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Templates",
      href: "/templates",
      icon: (
        <FileText className="text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Usage",
      href: "/settings/usage",
      icon: (
        <BarChart3 className="text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Settings",
      href: "/settings/account",
      icon: (
        <Settings className="text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col md:flex-row bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 w-full flex-1 overflow-hidden",
        "h-screen"
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10 bg-slate-900/50 backdrop-blur-xl border-r border-slate-800">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center justify-start gap-2 group/sidebar py-2 text-neutral-200 hover:text-white transition-colors"
              >
                <LogOut className="h-5 w-5 flex-shrink-0" />
                <motion.span
                  animate={{
                    display: open ? "inline-block" : "none",
                    opacity: open ? 1 : 0,
                  }}
                  className="text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
                >
                  Logout
                </motion.span>
              </button>
            </div>
          </div>
          {session?.user && (
            <div>
              <SidebarLink
                link={{
                  label: session.user.name || "User",
                  href: "/settings/account",
                  icon: (
                    <Image
                      src={session.user.image || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face"}
                      className="h-7 w-7 flex-shrink-0 rounded-full border border-slate-700"
                      width={50}
                      height={50}
                      alt="User Avatar"
                    />
                  ),
                }}
              />
            </div>
          )}
        </SidebarBody>
      </Sidebar>
      <Dashboard />
    </div>
  );
}

export const Logo = () => {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-gradient-to-r from-lime-500 to-emerald-600 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-white whitespace-pre"
      >
        Xantuus AI
      </motion.span>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-gradient-to-r from-lime-500 to-emerald-600 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </Link>
  );
};

// Dashboard component with content
const Dashboard = () => {
  return (
    <div className="flex flex-1">
      <div className="p-2 md:p-10 flex flex-col gap-6 flex-1 w-full h-full overflow-y-auto">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Welcome to Xantuus AI</h1>
          <p className="text-gray-400">Your AI-powered workspace for enhanced productivity</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Total Chats", value: "24", icon: "💬" },
            { title: "Templates Used", value: "12", icon: "📝" },
            { title: "Credits Used", value: "3.2K", icon: "⚡" },
            { title: "Active Workspace", value: "5", icon: "🚀" }
          ].map((stat, i) => (
            <div
              key={i}
              className="p-6 rounded-lg bg-slate-900/70 border border-slate-800 shadow-lg hover:border-primary/30 transition-colors"
            >
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.title}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
          <div className="p-6 rounded-lg bg-slate-900/70 border border-slate-800 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {[
                { action: "Created new chat", time: "2 hours ago" },
                { action: "Used template: Email Writer", time: "5 hours ago" },
                { action: "Updated settings", time: "1 day ago" },
              ].map((activity, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors">
                  <span className="text-gray-300">{activity.action}</span>
                  <span className="text-sm text-gray-500">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-lg bg-slate-900/70 border border-slate-800 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "New Chat", icon: "💬" },
                { label: "Browse Templates", icon: "📝" },
                { label: "View Usage", icon: "📊" },
                { label: "Integrations", icon: "🔌" },
              ].map((action, i) => (
                <button
                  key={i}
                  className="p-4 rounded-lg bg-slate-800/50 hover:bg-gradient-to-r hover:from-lime-500/10 hover:to-emerald-600/10 hover:border-primary/30 border border-slate-700 transition-all"
                >
                  <div className="text-2xl mb-2">{action.icon}</div>
                  <div className="text-sm text-gray-300">{action.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
