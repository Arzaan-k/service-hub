import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, Book, Filter } from "lucide-react";

interface Manual {
  id: string;
  name: string;
  model?: string;
  category?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  fileUrl?: string;
  uploadedAt?: string;
}

export default function Manuals() {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [model, setModel] = useState<string>("all");

  useEffect(() => {
    const fetchManuals = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/manuals");
        if (res.ok) {
          const data = await res.json();
          setManuals(Array.isArray(data) ? data : (data?.manuals || []));
        }
      } finally {
        setLoading(false);
      }
    };
    fetchManuals();
  }, []);

  const categories = Array.from(new Set(manuals.map(m => m.category).filter(Boolean))) as string[];
  const models = Array.from(new Set(manuals.map(m => m.model).filter(Boolean))) as string[];

  const filtered = manuals.filter(m => {
    const q = query.trim().toLowerCase();
    const matchesQ = !q || m.name.toLowerCase().includes(q) || (m.model || "").toLowerCase().includes(q);
    const matchesCat = category === "all" || (m.category || "").toLowerCase() === category.toLowerCase();
    const matchesModel = model === "all" || (m.model || "").toLowerCase() === model.toLowerCase();
    return matchesQ && matchesCat && matchesModel;
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Manuals Library" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Filters */}
          <Card className="rounded-lg border shadow-soft" style={{ background: '#FFF9F7', borderColor: '#FFE0D6' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Filter className="h-5 w-5 text-muted-foreground" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search manual name or model..." className="pl-10 input-soft" />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="input-soft h-10">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="input-soft h-10">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Manual list */}
          <Card className="rounded-lg border shadow-soft" style={{ background: '#FFF9F7', borderColor: '#FFE0D6' }}>
            <CardHeader>
              <CardTitle className="text-foreground">Available Manuals ({filtered.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-soft">
                  <thead className="border-b" style={{ borderColor: '#FFE0D6' }}>
                    <tr>
                      <th className="text-left py-3 px-2">Manual Name</th>
                      <th className="text-left py-3 px-2">Product / Model</th>
                      <th className="text-left py-3 px-2">Uploaded By</th>
                      <th className="text-left py-3 px-2">Date Uploaded</th>
                      <th className="text-left py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td className="py-6 px-2 text-muted-foreground" colSpan={5}>Loading manuals...</td>
                      </tr>
                    )}
                    {!loading && filtered.map(m => (
                      <tr key={m.id} className="border-b transition-all" style={{ borderColor: '#FFE0D6' }}>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FFE5B4', border: '1px solid #FFE0D6' }}>
                              <Book className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="font-medium text-foreground">{m.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">{m.model || m.category || "—"}</td>
                        <td className="py-3 px-2 text-muted-foreground">{m.uploadedByName || m.uploadedBy || "—"}</td>
                        <td className="py-3 px-2 text-muted-foreground">{m.uploadedAt ? new Date(m.uploadedAt).toLocaleDateString() : "—"}</td>
                        <td className="py-3 px-2">
                          {m.fileUrl ? (
                            <div className="flex items-center gap-2">
                              <a href={m.fileUrl} target="_blank" rel="noreferrer">
                                <Button
                                  className="px-3 py-2 rounded-md text-xs flex items-center gap-2"
                                  style={{ backgroundImage: 'linear-gradient(90deg, #FFD4E3, #FFE5B4, #FFA07A)', color: '#fff' }}
                                >
                                  View
                                </Button>
                              </a>
                              <a href={m.fileUrl} target="_blank" rel="noreferrer" download>
                                <Button className="px-3 py-2 rounded-md text-xs flex items-center gap-2" style={{ background: 'transparent', border: '1px solid #FFCBA4', color: '#2E2E2E', boxShadow: '0 0 0 0 rgba(255,180,150,0)' }}>
                                  <Download className="h-3 w-3" />
                                  Download
                                </Button>
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No file</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!loading && filtered.length === 0 && (
                      <tr>
                        <td className="py-6 px-2 text-muted-foreground" colSpan={5}>No manuals found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

