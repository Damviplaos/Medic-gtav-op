-- Weekly stats history table
CREATE TABLE IF NOT EXISTS weekly_stats_history (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start    date NOT NULL,
  total_work_seconds bigint NOT NULL DEFAULT 0,
  total_op_seconds   bigint NOT NULL DEFAULT 0,
  archived_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wsh_user_id ON weekly_stats_history(user_id);
CREATE INDEX IF NOT EXISTS idx_wsh_week_start ON weekly_stats_history(week_start DESC);

ALTER TABLE weekly_stats_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read weekly history"
  ON weekly_stats_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.system_role IN ('super_admin', 'admin')
    )
  );

-- Function: archive current week + reset
CREATE OR REPLACE FUNCTION archive_and_reset_weekly_stats()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_week_start date;
BEGIN
  v_week_start := date_trunc('week', now() AT TIME ZONE 'Asia/Bangkok')::date;

  -- Copy current week data to history (avoid duplicates per user+week)
  INSERT INTO weekly_stats_history (user_id, week_start, total_work_seconds, total_op_seconds)
  SELECT ws.user_id, ws.week_start, ws.total_work_seconds, ws.total_op_seconds
  FROM weekly_stats ws
  WHERE ws.week_start = v_week_start
    AND NOT EXISTS (
      SELECT 1 FROM weekly_stats_history wsh
      WHERE wsh.user_id = ws.user_id
        AND wsh.week_start = ws.week_start
    );

  -- Delete archived rows from current week
  DELETE FROM weekly_stats WHERE week_start = v_week_start;

  -- Prune history older than 14 days
  DELETE FROM weekly_stats_history
  WHERE archived_at < now() - interval '14 days';
END;
$$;

-- Matchmaking pairs table
CREATE TABLE IF NOT EXISTS matchmaking_pairs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  matched_at  timestamptz NOT NULL DEFAULT now(),
  notes       text,
  CONSTRAINT unique_pair UNIQUE (user_a_id, user_b_id)
);

ALTER TABLE matchmaking_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage matchmaking"
  ON matchmaking_pairs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.system_role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Users view own pairing"
  ON matchmaking_pairs FOR SELECT
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());