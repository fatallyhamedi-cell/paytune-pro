import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { getDbStore, setDbStore } from '../config/supabase_mock';

export const listCategories = async (req: Request, res: Response) => {
  try {
    let categories: any[] = [];

    try {
      const { data, error } = await supabaseAdmin
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!error && data && data.length > 0) {
        categories = data;
      }
    } catch (dbErr) {
      // Fallback to store
    }

    if (categories.length === 0) {
      const store = getDbStore();
      categories = (store?.categories || []).filter((c: any) => c.is_active !== false);
    }

    // Sort by display_order
    categories.sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0));

    return res.json({
      success: true,
      categories
    });
  } catch (err: any) {
    console.error('listCategories error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch categories' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, slug, icon, display_order, is_featured } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const cleanSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newCategory = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      slug: cleanSlug,
      icon: icon || null,
      display_order: Number(display_order) || 0,
      is_active: true,
      is_featured: Boolean(is_featured),
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabaseAdmin
        .from('categories')
        .insert([newCategory])
        .select()
        .single();
      if (!error && data) {
        return res.status(201).json({ success: true, category: data });
      }
    } catch {}

    const store = getDbStore();
    store.categories = store.categories || [];
    store.categories.push(newCategory);
    setDbStore(store);

    return res.status(201).json({ success: true, category: newCategory });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create category' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from('categories')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        return res.json({ success: true, category: data });
      }
    } catch {}

    const store = getDbStore();
    store.categories = (store.categories || []).map((c: any) =>
      c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
    );
    setDbStore(store);

    const updated = store.categories.find((c: any) => c.id === id);
    return res.json({ success: true, category: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update category' });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    try {
      await supabaseAdmin.from('categories').delete().eq('id', id);
    } catch {}

    const store = getDbStore();
    store.categories = (store.categories || []).filter((c: any) => c.id !== id);
    setDbStore(store);

    return res.json({ success: true, message: 'Category removed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete category' });
  }
};
