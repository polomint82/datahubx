import { Link, useLocation } from "wouter";
import { Gauge, ServerCog, Table, Settings, FolderOpen, Users, Menu, Map, ChevronDown, ChevronRight, Clock, TestTube, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: Gauge },
  { name: "File Explorer", href: "/files", icon: FolderOpen },
  { 
    name: "Datasets", 
    href: "/datasets", 
    icon: Table,
    submenu: [
      { name: "Maps", href: "/property-maps", icon: Map }
    ]
  },
  { name: "Transformations", href: "/transformations", icon: ServerCog },
  { name: "Scheduled Jobs", href: "/jobs", icon: Clock },
  { name: "Team", href: "/team", icon: Users },
  { name: "Test Dashboard", href: "/tests", icon: TestTube },
  { name: "SARIF Analyzer", href: "/sarif", icon: FileSearch },
  { name: "Admin", href: "/admin", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  return (
    <aside className={cn(
      "hidden lg:flex lg:flex-col border-r border-gray-700 transition-all duration-300 h-screen",
      isCollapsed ? "w-16" : "w-64"
    )} style={{ backgroundColor: '#152238' }}>
      <div className={cn(
        "flex items-center h-16 px-2 border-b border-gray-600",
        isCollapsed ? "justify-center" : "justify-end"
      )}>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-white hover:text-gray-300 px-2 py-2 rounded-md hover:bg-white/5 transition-colors"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>
      
      <nav className="flex-1 px-2 py-6 space-y-1">
        {navigation.map((item) => {
          const isActive = location === item.href;
          const hasSubmenu = item.submenu && item.submenu.length > 0;
          const isExpanded = expandedMenus.includes(item.name);
          const isSubmenuActive = hasSubmenu && item.submenu.some(sub => location === sub.href);
          
          const toggleSubmenu = (e: React.MouseEvent) => {
            if (hasSubmenu && !isCollapsed) {
              e.preventDefault();
              e.stopPropagation();
              setExpandedMenus(prev => 
                prev.includes(item.name) 
                  ? prev.filter(name => name !== item.name)
                  : [...prev, item.name]
              );
            }
          };

          return (
            <div key={item.name}>
              {hasSubmenu && !isCollapsed ? (
                <div>
                  <Link href={item.href}>
                    <div
                      className={cn(
                        "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                        isActive || isSubmenuActive
                          ? "bg-white/10 text-white"
                          : "text-gray-300 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <item.icon className="h-4 w-4 mr-3 text-gray-400 group-hover:text-white" />
                      <span className="flex-1">{item.name}</span>
                      <button
                        onClick={toggleSubmenu}
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </Link>
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.submenu.map((subItem) => {
                        const isSubActive = location === subItem.href;
                        return (
                          <Link key={subItem.name} href={subItem.href}>
                            <div
                              className={cn(
                                "group flex items-center px-2 py-2 text-sm rounded-md transition-colors cursor-pointer",
                                isSubActive
                                  ? "bg-white/10 text-white"
                                  : "text-gray-400 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <subItem.icon className="h-4 w-4 flex-shrink-0 mr-3" />
                              {subItem.name}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <Link href={item.href}>
                  <div
                    className={cn(
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                      isCollapsed ? "justify-center" : "",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4",
                        !isCollapsed && "mr-3",
                        isActive
                          ? "text-white"
                          : "text-gray-400 group-hover:text-white"
                      )}
                    />
                    {!isCollapsed && item.name}
                  </div>
                </Link>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
