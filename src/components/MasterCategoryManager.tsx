import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Star,
  Check,
  X,
  Loader2,
  AlertCircle,
  ArrowUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  display_order?: number;
  is_visible?: boolean;
  is_featured?: boolean;
}

export function MasterCategoryManager() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formIcon, setFormIcon] = useState("");
  const [formOrder, setFormOrder] = useState<number>(0);
  const [formVisible, setFormVisible] = useState(true);
  const [formFeatured, setFormFeatured] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch categories
  const { data: categories = [], isLoading, error } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await axios.get("/api/categories");
      return Array.isArray(res.data) ? res.data : (res.data?.categories || []);
    }
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleStartAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormName("");
    setFormSlug("");
    setFormIcon("🎵");
    setFormOrder(categories.length + 1);
    setFormVisible(true);
    setFormFeatured(false);
    setErrorMessage(null);
  };

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id);
    setIsAdding(false);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormIcon(cat.icon || "");
    setFormOrder(cat.display_order ?? 0);
    setFormVisible(cat.is_visible !== false);
    setFormFeatured(cat.is_featured === true);
    setErrorMessage(null);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setErrorMessage(null);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Category>) => {
      const res = await axios.post("/api/categories", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsAdding(false);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error || "Failed to create category");
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Category> & { id: string }) => {
      const res = await axios.put(`/api/categories/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingId(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error || "Failed to update category");
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await axios.delete(`/api/categories/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || "Failed to delete category");
    }
  });

  const handleSave = () => {
    if (!formName.trim()) {
      setErrorMessage("Category name is required.");
      return;
    }
    const finalSlug = formSlug.trim() || generateSlug(formName);

    if (isAdding) {
      createMutation.mutate({
        name: formName.trim(),
        slug: finalSlug,
        icon: formIcon.trim(),
        display_order: Number(formOrder),
        is_visible: formVisible,
        is_featured: formFeatured
      });
    } else if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: formName.trim(),
        slug: finalSlug,
        icon: formIcon.trim(),
        display_order: Number(formOrder),
        is_visible: formVisible,
        is_featured: formFeatured
      });
    }
  };

  const handleToggleVisibility = (cat: Category) => {
    updateMutation.mutate({
      id: cat.id,
      is_visible: !(cat.is_visible !== false)
    });
  };

  const handleToggleFeatured = (cat: Category) => {
    updateMutation.mutate({
      id: cat.id,
      is_featured: !cat.is_featured
    });
  };

  const sortedCategories = [...categories].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-black text-gray-900 dark:text-white">
              Category Discovery Management
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manage horizontal discovery bar categories, display order, visibility, and featured tags without code deployments.
          </p>
        </div>

        <Button
          onClick={handleStartAdd}
          disabled={isAdding}
          className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-sm rounded-xl cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Category</span>
        </Button>
      </div>

      {/* Add / Edit Form Modal / Card */}
      {(isAdding || editingId) && (
        <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/30 space-y-4">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {isAdding ? <Plus className="w-4 h-4 text-amber-500" /> : <Pencil className="w-4 h-4 text-amber-500" />}
              {isAdding ? "Create New Discovery Category" : `Edit Category`}
            </h3>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">
                Category Name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (isAdding) {
                    setFormSlug(generateSlug(e.target.value));
                  }
                }}
                placeholder="e.g. Rwandan Hits"
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#202020] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">
                Slug (URL Identifier)
              </label>
              <input
                type="text"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="e.g. rwandan-hits"
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#202020] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">
                Icon (Emoji or symbol)
              </label>
              <input
                type="text"
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                placeholder="e.g. 🇷🇼 or 🎵"
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#202020] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block">
                Display Order
              </label>
              <input
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#202020] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
              <input
                type="checkbox"
                checked={formVisible}
                onChange={(e) => setFormVisible(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
              />
              <span>Visible in Category Bar</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
              <input
                type="checkbox"
                checked={formFeatured}
                onChange={(e) => setFormFeatured(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
              />
              <span>Featured Highlight</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-amber-500/20">
            <Button variant="outline" size="sm" onClick={handleCancel} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 mr-1" />
              )}
              <span>{isAdding ? "Create Category" : "Save Changes"}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Category List Table */}
      <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          </div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No categories found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-[#202020] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="p-3.5">Order</th>
                  <th className="p-3.5">Icon</th>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Slug</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Featured</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-[#1c1c1c] transition-colors">
                    <td className="p-3.5 font-mono text-gray-400">{cat.display_order ?? "-"}</td>
                    <td className="p-3.5 text-base">{cat.icon || "🎵"}</td>
                    <td className="p-3.5 font-bold text-gray-900 dark:text-white">{cat.name}</td>
                    <td className="p-3.5 font-mono text-gray-500">{cat.slug}</td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleVisibility(cat)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                          cat.is_visible !== false
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-gray-200 dark:bg-gray-800 text-gray-500"
                        }`}
                      >
                        {cat.is_visible !== false ? (
                          <>
                            <Eye className="w-3 h-3" /> Visible
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" /> Hidden
                          </>
                        )}
                      </button>
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleFeatured(cat)}
                        className={`p-1 rounded cursor-pointer ${
                          cat.is_featured ? "text-amber-500" : "text-gray-300 dark:text-gray-700 hover:text-gray-400"
                        }`}
                        title={cat.is_featured ? "Featured category" : "Mark as featured"}
                      >
                        <Star className={`w-4 h-4 ${cat.is_featured ? "fill-amber-500" : ""}`} />
                      </button>
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(cat)}
                        className="h-7 w-7 p-0 cursor-pointer"
                        title="Edit category"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete category "${cat.name}"?`)) {
                            deleteMutation.mutate(cat.id);
                          }
                        }}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 cursor-pointer"
                        title="Delete category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
