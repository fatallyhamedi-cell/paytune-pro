import { Request, Response } from 'express';
import { rawSupabaseAdmin, supabaseAdmin } from '../config/supabase';
import { cacheService } from '../services/cacheService';

const CATEGORIES_CACHE_KEY = 'paytune:categories:active';

function normalizeCategory(c: any) {
  return {
    id: String(c.id),
    parent_category_id: c.parent_category_id || null,
    name: c.name,
    slug: c.slug,
    description: c.description || null,
    icon: c.icon || c.icon_path || null,
    image_path: c.image_path || null,
    display_order: Number(c.display_order) || 0,
    is_visible: c.is_visible ?? c.is_active ?? true,
    is_active: c.is_visible ?? c.is_active ?? true,
    is_featured: Boolean(c.is_featured),
    record_status: c.record_status || 'active',
    created_at: c.created_at || new Date().toISOString(),
  };
}

export const listCategories = async (_req: Request, res: Response) => {
  try {
    const cached = await cacheService.get<any[]>(CATEGORIES_CACHE_KEY);
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        categories: cached,
      });
    }

    const client = rawSupabaseAdmin || supabaseAdmin;
    const { data, error } = await client
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    const categories = (data || [])
      .filter((c: any) => c.is_visible !== false && c.is_active !== false && c.record_status !== 'deleted')
      .map(normalizeCategory)
      .sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0));

    await cacheService.set(CATEGORIES_CACHE_KEY, categories, 300);

    return res.json({
      success: true,
      categories,
    });
  } catch (err: any) {
    console.error('listCategories error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch categories' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, slug, icon, display_order, is_featured, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const cleanSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const nowIso = new Date().toISOString();

    const pgPayload = {
      name: name.trim(),
      slug: cleanSlug,
      description: description || null,
      icon_path: icon || null,
      display_order: Number(display_order) || 0,
      is_visible: true,
      is_featured: Boolean(is_featured),
      record_status: 'active',
      created_at: nowIso,
      updated_at: nowIso,
    };

    const client = rawSupabaseAdmin || supabaseAdmin;
    const { data, error } = await client
      .from('categories')
      .insert([pgPayload])
      .select()
      .single();

    if (error) throw error;

    await cacheService.del(CATEGORIES_CACHE_KEY);
    return res.status(201).json({ success: true, category: normalizeCategory(data) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create category' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.is_active !== undefined && updates.is_visible === undefined) {
      updates.is_visible = updates.is_active;
    }
    if (updates.icon !== undefined && updates.icon_path === undefined) {
      updates.icon_path = updates.icon;
    }

    const pgUpdates: any = { updated_at: new Date().toISOString() };
    for (const key of ['name', 'slug', 'description', 'icon_path', 'image_path', 'display_order', 'is_featured', 'is_visible', 'record_status']) {
      if (updates[key] !== undefined) pgUpdates[key] = updates[key];
    }

    const client = rawSupabaseAdmin || supabaseAdmin;
    const { data, error } = await client
      .from('categories')
      .update(pgUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await cacheService.del(CATEGORIES_CACHE_KEY);
    return res.json({ success: true, category: normalizeCategory(data) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update category' });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = rawSupabaseAdmin || supabaseAdmin;
    const { error } = await client.from('categories').delete().eq('id', id);
    if (error) throw error;

    await cacheService.del(CATEGORIES_CACHE_KEY);
    return res.json({ success: true, message: 'Category removed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete category' });
  }
};
