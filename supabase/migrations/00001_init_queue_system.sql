
-- Doctors table: stores all doctors in the system
CREATE TABLE doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'op' CHECK (status IN ('op', 'activity', 'afk', 'off_duty', 'story')),
  queue_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Operator table: tracks who is the current OP runner
CREATE TABLE operator (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Queue pointer: which doctor index the pointer is at
CREATE TABLE queue_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pointer_index integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Settings table
CREATE TABLE settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default queue state
INSERT INTO queue_state (pointer_index) VALUES (0);

-- Insert default settings
INSERT INTO settings (key, value) VALUES
  ('server_url', ''),
  ('manual_mode', 'true');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER doctors_updated_at
  BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER queue_state_updated_at
  BEFORE UPDATE ON queue_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS on all tables
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Doctors: allow all for authenticated users, read for anon
CREATE POLICY "anon can read doctors" ON doctors FOR SELECT TO anon USING (true);
CREATE POLICY "anon cannot insert doctors" ON doctors FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "anon cannot update doctors" ON doctors FOR UPDATE TO anon USING (false);
CREATE POLICY "anon cannot delete doctors" ON doctors FOR DELETE TO anon USING (false);
CREATE POLICY "auth can read doctors" ON doctors FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can insert doctors" ON doctors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth can update doctors" ON doctors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth can delete doctors" ON doctors FOR DELETE TO authenticated USING (true);

-- Operator: allow all for authenticated users, read for anon
CREATE POLICY "anon can read operator" ON operator FOR SELECT TO anon USING (true);
CREATE POLICY "anon cannot insert operator" ON operator FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "anon cannot update operator" ON operator FOR UPDATE TO anon USING (false);
CREATE POLICY "anon cannot delete operator" ON operator FOR DELETE TO anon USING (false);
CREATE POLICY "auth can read operator" ON operator FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can insert operator" ON operator FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth can update operator" ON operator FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth can delete operator" ON operator FOR DELETE TO authenticated USING (true);

-- Queue state: allow all for authenticated users, read for anon
CREATE POLICY "anon can read queue_state" ON queue_state FOR SELECT TO anon USING (true);
CREATE POLICY "anon cannot insert queue_state" ON queue_state FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "anon cannot update queue_state" ON queue_state FOR UPDATE TO anon USING (false);
CREATE POLICY "anon cannot delete queue_state" ON queue_state FOR DELETE TO anon USING (false);
CREATE POLICY "auth can read queue_state" ON queue_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can insert queue_state" ON queue_state FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth can update queue_state" ON queue_state FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth can delete queue_state" ON queue_state FOR DELETE TO authenticated USING (true);

-- Settings: allow all for authenticated users, read for anon
CREATE POLICY "anon can read settings" ON settings FOR SELECT TO anon USING (true);
CREATE POLICY "anon cannot insert settings" ON settings FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "anon cannot update settings" ON settings FOR UPDATE TO anon USING (false);
CREATE POLICY "anon cannot delete settings" ON settings FOR DELETE TO anon USING (false);
CREATE POLICY "auth can read settings" ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can insert settings" ON settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth can update settings" ON settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth can delete settings" ON settings FOR DELETE TO authenticated USING (true);

-- Enable realtime on all tables
ALTER PUBLICATION supabase_realtime ADD TABLE doctors;
ALTER PUBLICATION supabase_realtime ADD TABLE operator;
ALTER PUBLICATION supabase_realtime ADD TABLE queue_state;
