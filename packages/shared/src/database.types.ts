// ============================================================
// TYPES SUPABASE — Schéma de la base de données
// ============================================================

export interface Database {
  public: {
    Tables: {
      exam_sessions: {
        Row: ExamSessionRow;
        Insert: ExamSessionInsert;
        Update: Partial<ExamSessionInsert>;
        Relationships: [];
      };
      session_jurys: {
        Row: SessionJuryRow;
        Insert: SessionJuryInsert;
        Update: Partial<SessionJuryInsert>;
        Relationships: [];
      };
      jury_members: {
        Row: JuryMemberRow;
        Insert: JuryMemberInsert;
        Update: Partial<JuryMemberInsert>;
        Relationships: [];
      };
      session_eleves: {
        Row: SessionEleveRow;
        Insert: SessionEleveInsert;
        Update: Partial<SessionEleveInsert>;
        Relationships: [];
      };
      evaluations: {
        Row: EvaluationRow;
        Insert: EvaluationInsert;
        Update: Partial<EvaluationInsert>;
        Relationships: [];
      };
      final_scores: {
        Row: FinalScoreRow;
        Insert: FinalScoreInsert;
        Update: Partial<FinalScoreInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// === exam_sessions ===
export interface ExamSessionRow {
  id: string;
  code: string;
  scenario_name: string | null;
  date_oral: string | null;
  created_at: string;
  expires_at: string;
}
export interface ExamSessionInsert {
  id?: string;
  code: string;
  scenario_name?: string | null;
  date_oral?: string | null;
  created_at?: string;
  expires_at: string;
}

// === session_jurys ===
export interface SessionJuryRow {
  id: string;
  session_id: string;
  jury_number: number;
  jury_name: string;
  salle: string | null;
  mode: string;
}
export interface SessionJuryInsert {
  id?: string;
  session_id: string;
  jury_number: number;
  jury_name: string;
  salle?: string | null;
  mode?: string;
}

// === jury_members ===
export interface JuryMemberRow {
  id: string;
  jury_id: string;
  user_id: string;
  slot: string;
  joined_at: string;
}
export interface JuryMemberInsert {
  id?: string;
  jury_id: string;
  user_id?: string;
  slot: string;
  joined_at?: string;
}

// === session_eleves ===
export interface SessionEleveRow {
  id: string;
  jury_id: string;
  eleve_hash: string;
  display_name: string;
  classe: string | null;
  parcours: string | null;
  sujet: string | null;
  binome_id: string | null;
  ordre_passage: number | null;
  heure_passage: string | null;
  status: string;
}
export interface SessionEleveInsert {
  id?: string;
  jury_id: string;
  eleve_hash: string;
  display_name: string;
  classe?: string | null;
  parcours?: string | null;
  sujet?: string | null;
  binome_id?: string | null;
  ordre_passage?: number | null;
  heure_passage?: string | null;
  status?: string;
}

// === evaluations ===
export interface EvaluationRow {
  id: string;
  eleve_id: string;
  juror_slot: string;
  score_expression: number | null;
  score_diaporama: number | null;
  score_reactivite: number | null;
  score_contenu: number | null;
  score_structure: number | null;
  score_engagement: number | null;
  total_oral: number | null;
  total_sujet: number | null;
  total: number | null;
  points_forts: string | null;
  axes_amelioration: string | null;
  submitted_at: string | null;
}
export interface EvaluationInsert {
  id?: string;
  eleve_id: string;
  juror_slot: string;
  score_expression?: number | null;
  score_diaporama?: number | null;
  score_reactivite?: number | null;
  score_contenu?: number | null;
  score_structure?: number | null;
  score_engagement?: number | null;
  total_oral?: number | null;
  total_sujet?: number | null;
  total?: number | null;
  points_forts?: string | null;
  axes_amelioration?: string | null;
  submitted_at?: string | null;
}

// === final_scores ===
export interface FinalScoreRow {
  id: string;
  eleve_id: string;
  score_expression: number;
  score_diaporama: number;
  score_reactivite: number;
  score_contenu: number;
  score_structure: number;
  score_engagement: number;
  total_oral: number;
  total_sujet: number;
  total: number;
  points_forts: string | null;
  axes_amelioration: string | null;
  validated_at: string;
}
export interface FinalScoreInsert {
  id?: string;
  eleve_id: string;
  score_expression: number;
  score_diaporama: number;
  score_reactivite: number;
  score_contenu: number;
  score_structure: number;
  score_engagement: number;
  total_oral: number;
  total_sujet: number;
  total: number;
  points_forts?: string | null;
  axes_amelioration?: string | null;
  validated_at?: string;
}
