import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import StratifiedKFold, train_test_split

XGBRegressor = None
HAS_XGBOOST = False


def load_xgboost():
    global XGBRegressor, HAS_XGBOOST
    try:
        from xgboost import XGBRegressor as _XGBRegressor
        XGBRegressor = _XGBRegressor
        HAS_XGBOOST = True
    except Exception:
        XGBRegressor = None
        HAS_XGBOOST = False

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR.parent / 'data' / 'merged_jobs_dataset.json'
MODEL_DIR = BASE_DIR / 'models'
MODEL_PATH = MODEL_DIR / 'hybrid_model.joblib'
RANDOM_SEED = 42

EXPERIENCE_LEVELS = {
    'Entry Level': 1,
    'Mid Level': 2,
    'Senior Level': 3,
    'Expert': 4
}


def infer_experience_level(title, explicit_level=None):
    value = str(explicit_level or '').strip().lower()
    if value:
        if any(k in value for k in ['expert', 'principal', 'director', 'head', 'chief', 'vp']):
            return 'Expert'
        if any(k in value for k in ['senior', 'lead', 'staff']):
            return 'Senior Level'
        if any(k in value for k in ['mid', 'associate', 'intermediate']):
            return 'Mid Level'
        if any(k in value for k in ['entry', 'junior', 'fresher', 'intern']):
            return 'Entry Level'

    t = str(title or '').lower()
    if any(k in t for k in ['principal', 'head', 'director', 'chief', 'vp', 'architect']):
        return 'Expert'
    if any(k in t for k in ['senior', 'lead', 'staff']):
        return 'Senior Level'
    if any(k in t for k in ['mid', 'associate', 'ii', 'iii']):
        return 'Mid Level'
    return 'Entry Level'

SKILL_RELATIONS = {
    'javascript': ['js', 'es6', 'ecmascript', 'typescript', 'node.js', 'react', 'vue', 'angular'],
    'python': ['django', 'flask', 'fastapi', 'pandas', 'numpy', 'pytorch', 'tensorflow'],
    'java': ['spring', 'spring boot', 'hibernate', 'jvm', 'kotlin'],
    'aws': ['amazon web services', 'ec2', 's3', 'lambda', 'cloud computing'],
    'react': ['react.js', 'reactjs', 'redux', 'next.js'],
    'node.js': ['nodejs', 'express', 'express.js'],
    'sql': ['mysql', 'postgresql', 'sqlite', 'database', 'rdbms'],
    'machine learning': ['ml', 'deep learning', 'ai', 'neural networks', 'nlp'],
    'data science': ['data analysis', 'data analytics', 'statistics', 'data visualization']
}


def normalize_skill(value):
    return str(value or '').strip().lower()


def parse_salary_to_number(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).replace(',', '')
    nums = [int(tok) for tok in ''.join(ch if ch.isdigit() else ' ' for ch in text).split() if tok.isdigit()]
    if not nums:
        return None

    avg = sum(nums) / len(nums)
    if avg < 1000:
        avg = avg * 1000
    return float(avg)


def experience_score(user_level, job_level):
    ur = EXPERIENCE_LEVELS.get(user_level, 1)
    jr = EXPERIENCE_LEVELS.get(job_level, 1)
    diff = abs(ur - jr)
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.6
    if diff == 2:
        return 0.25
    return 0.0


def salary_score(user_salary, job_salary):
    us = parse_salary_to_number(user_salary)
    js = parse_salary_to_number(job_salary)
    if us is None or js is None:
        return 0.5
    if js >= us:
        return 1.0
    return max(0.0, min(1.0, js / us))


def compute_match_features(user_skills, job_skills):
    user_norm = [normalize_skill(s) for s in user_skills]
    job_norm = [normalize_skill(s) for s in job_skills]

    direct = []
    related = []
    missing = []

    for js in job_norm:
        if js in user_norm:
            direct.append(js)
            continue

        found = False
        for base, rel in SKILL_RELATIONS.items():
            if js in rel and base in user_norm:
                related.append({'jobSkill': js, 'userSkill': base})
                found = True
                break
            if js == base:
                hit = next((r for r in rel if r in user_norm), None)
                if hit is not None:
                    related.append({'jobSkill': js, 'userSkill': hit})
                    found = True
                    break

        if not found:
            missing.append(js)

    total_required = max(1, len(job_norm))
    skill_match_ratio = len(direct) / total_required
    related_ratio = len(related) / total_required
    match_count_norm = min(1.0, len(direct) / 10.0)

    return {
        'direct': direct,
        'related': related,
        'missing': missing,
        'skill_match_ratio': skill_match_ratio,
        'related_ratio': related_ratio,
        'match_count_norm': match_count_norm
    }


def load_jobs(dataset_path):
    with open(dataset_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    jobs = []
    for item in data:
        title = item.get('title') or item.get('job_title') or 'Unknown'
        experience_level = infer_experience_level(
            title,
            item.get('experienceLevel') or item.get('experience_level')
        )
        jobs.append({
            'title': title,
            'description': item.get('description') or '',
            'skills': item.get('skillsRequired') or item.get('skills_required') or [],
            'experienceLevel': experience_level,
            'salary': item.get('salary'),
            'company': item.get('company') or 'Various Companies',
            'location': item.get('location') or 'Remote',
            'certifications': item.get('certifications') or [],
            'source': item.get('source') or 'dataset'
        })

    return jobs


def title_family(title):
    text = str(title or '').lower().strip()
    if not text:
        return 'unknown'

    stop = {
        'senior', 'junior', 'lead', 'principal', 'staff', 'associate',
        'chief', 'head', 'director', 'vp', 'of', 'in', 'for', '&'
    }
    tokens = [t for t in ''.join(ch if ch.isalnum() else ' ' for ch in text).split() if t and t not in stop]
    if not tokens:
        return 'unknown'
    if len(tokens) == 1:
        return tokens[0]
    return f"{tokens[-2]} {tokens[-1]}"


def sample_user_skills(job_skills, rng, min_keep=2, max_keep=8):
    if not job_skills:
        return []
    skills = [normalize_skill(s) for s in job_skills if normalize_skill(s)]
    if not skills:
        return []

    keep = rng.integers(min_keep, min(max_keep, len(skills)) + 1)
    keep = int(max(1, min(len(skills), keep)))
    idx = rng.choice(len(skills), size=keep, replace=False)
    return [skills[i] for i in idx]


def feature_row_for_profile_job(user_skills, user_level, user_salary, job_idx, jobs, vectorizer, tfidf_matrix):
    job = jobs[job_idx]
    user_vec = vectorizer.transform([' '.join(user_skills)])
    cosine = float(cosine_similarity(user_vec, tfidf_matrix[job_idx])[0][0])
    match = compute_match_features(user_skills, job['skills'])
    exp = experience_score(user_level, job['experienceLevel'])
    sal = salary_score(user_salary, job.get('salary'))

    row = [
        cosine,
        match['skill_match_ratio'],
        match['match_count_norm'],
        exp,
        match['related_ratio'],
        sal
    ]

    rank_target = (
        cosine * 0.35
        + match['skill_match_ratio'] * 0.35
        + exp * 0.15
        + match['related_ratio'] * 0.1
        + sal * 0.05
    )

    return row, rank_target


def build_training_matrix(jobs, negatives_per_positive=2):
    rng = np.random.default_rng(RANDOM_SEED)
    corpus = [' '.join([normalize_skill(s) for s in j['skills']]) for j in jobs]
    vectorizer = TfidfVectorizer(min_df=1)
    tfidf_matrix = vectorizer.fit_transform(corpus)

    job_skill_sets = [set(normalize_skill(s) for s in j['skills'] if normalize_skill(s)) for j in jobs]

    features = []
    y_class = []
    y_rank = []
    groups = []
    families = []

    n_jobs = len(jobs)
    all_indices = np.arange(n_jobs)

    for anchor_idx, job in enumerate(jobs):
        if not job['skills']:
            continue

        profile_skills = sample_user_skills(job['skills'], rng)
        profile_set = set(profile_skills)
        if not profile_set:
            continue

        user_level = job['experienceLevel']
        user_salary = job.get('salary')

        # Build candidates by overlap with the profile (harder supervision).
        near_positive_candidates = []
        hard_negative_candidates = []
        easy_negative_candidates = []

        for j_idx, jset in enumerate(job_skill_sets):
            if not jset:
                continue
            overlap = len(profile_set & jset) / max(1, len(profile_set))

            if j_idx == anchor_idx:
                near_positive_candidates.append((j_idx, overlap))
            elif overlap >= 0.5:
                near_positive_candidates.append((j_idx, overlap))
            elif overlap >= 0.2:
                hard_negative_candidates.append((j_idx, overlap))
            else:
                easy_negative_candidates.append((j_idx, overlap))

        if not near_positive_candidates:
            continue

        # Positive sample from near-positive set (can be source or similar role)
        near_positive_candidates.sort(key=lambda x: x[1], reverse=True)
        pos_choice_pool = [idx for idx, _ in near_positive_candidates[: min(5, len(near_positive_candidates))]]
        pos_idx = int(rng.choice(pos_choice_pool))

        # Positive sample: profile versus near-positive job
        pos_row, pos_target = feature_row_for_profile_job(
            profile_skills, user_level, user_salary, pos_idx, jobs, vectorizer, tfidf_matrix
        )
        features.append(pos_row)
        y_class.append(1)
        y_rank.append(min(1.0, max(0.0, pos_target)))
        groups.append(anchor_idx)
        families.append(title_family(jobs[anchor_idx]['title']))

        # Negative samples: prefer hard negatives, then easy negatives
        hard_neg_ids = [idx for idx, _ in hard_negative_candidates]
        easy_neg_ids = [idx for idx, _ in easy_negative_candidates]

        selected_negs = []
        hard_take = min(len(hard_neg_ids), max(1, negatives_per_positive // 2))
        if hard_take > 0:
            selected_negs.extend(rng.choice(hard_neg_ids, size=hard_take, replace=False).tolist())

        remain = negatives_per_positive - len(selected_negs)
        if remain > 0 and easy_neg_ids:
            selected_negs.extend(rng.choice(easy_neg_ids, size=min(remain, len(easy_neg_ids)), replace=False).tolist())

        # Final fallback if candidate pools are small
        if len(selected_negs) < negatives_per_positive:
            banned = set(selected_negs + [pos_idx])
            rest = [i for i in all_indices.tolist() if i not in banned]
            if rest:
                add = rng.choice(rest, size=min(negatives_per_positive - len(selected_negs), len(rest)), replace=False)
                selected_negs.extend(add.tolist())

        for neg_idx in selected_negs:
            neg_row, neg_target = feature_row_for_profile_job(
                profile_skills, user_level, user_salary, int(neg_idx), jobs, vectorizer, tfidf_matrix
            )
            features.append(neg_row)
            y_class.append(0)
            # Keep continuous target but down-weight negatives for ranking supervision.
            y_rank.append(min(1.0, max(0.0, neg_target * 0.4)))
            groups.append(anchor_idx)
            families.append(title_family(jobs[anchor_idx]['title']))

    X = np.array(features, dtype=float)
    y_class = np.array(y_class, dtype=int)
    y_rank = np.array(y_rank, dtype=float)
    groups = np.array(groups, dtype=int)
    families = np.array(families, dtype=object)

    return X, y_class, y_rank, groups, families, vectorizer, tfidf_matrix


def train_models(dataset_path=DATASET_PATH, model_path=MODEL_PATH):
    load_xgboost()
    jobs = load_jobs(dataset_path)
    X, y_class, y_rank, groups, families, vectorizer, tfidf_matrix = build_training_matrix(jobs, negatives_per_positive=3)

    X_train, X_test, y_train, y_test, y_rank_train, y_rank_test = train_test_split(
        X, y_class, y_rank, test_size=0.2, random_state=42, stratify=y_class
    )

    rf = RandomForestClassifier(
        n_estimators=250,
        max_depth=10,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=RANDOM_SEED,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)
    rf_prob = rf.predict_proba(X_test)[:, 1]

    gbr = GradientBoostingRegressor(
        n_estimators=220,
        learning_rate=0.05,
        max_depth=3,
        random_state=RANDOM_SEED
    )
    gbr.fit(X_train, y_rank_train)

    xgb = None
    if HAS_XGBOOST:
        xgb = XGBRegressor(
            n_estimators=260,
            learning_rate=0.05,
            max_depth=4,
            subsample=0.9,
            colsample_bytree=0.9,
            objective='reg:squarederror',
            random_state=RANDOM_SEED
        )
        xgb.fit(X_train, y_rank_train)

    y_pred = (rf_prob >= 0.5).astype(int)
    accuracy = float(accuracy_score(y_test, y_pred))
    precision = float(precision_score(y_test, y_pred, zero_division=0))
    recall = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    try:
        auc = float(roc_auc_score(y_test, rf_prob))
    except Exception:
        auc = 0.5

    # Group holdout evaluation: unseen profile groups in validation split.
    rng = np.random.default_rng(RANDOM_SEED)
    unique_groups = np.unique(groups)
    rng.shuffle(unique_groups)
    cut = int(0.8 * len(unique_groups))
    train_groups = set(unique_groups[:cut].tolist())
    test_groups = set(unique_groups[cut:].tolist())

    group_train_mask = np.array([g in train_groups for g in groups], dtype=bool)
    group_test_mask = np.array([g in test_groups for g in groups], dtype=bool)

    Xg_train = X[group_train_mask]
    yg_train = y_class[group_train_mask]
    Xg_test = X[group_test_mask]
    yg_test = y_class[group_test_mask]

    group_precision = 0.0
    group_recall = 0.0
    group_f1 = 0.0
    group_auc = 0.5
    group_accuracy = 0.0

    if len(Xg_train) > 0 and len(Xg_test) > 0 and len(np.unique(yg_train)) > 1 and len(np.unique(yg_test)) > 1:
        group_rf = RandomForestClassifier(
            n_estimators=220,
            max_depth=9,
            min_samples_split=4,
            min_samples_leaf=2,
            random_state=RANDOM_SEED,
            n_jobs=-1
        )
        group_rf.fit(Xg_train, yg_train)
        yg_prob = group_rf.predict_proba(Xg_test)[:, 1]
        yg_pred = (yg_prob >= 0.5).astype(int)

        group_accuracy = float(accuracy_score(yg_test, yg_pred))
        group_precision = float(precision_score(yg_test, yg_pred, zero_division=0))
        group_recall = float(recall_score(yg_test, yg_pred, zero_division=0))
        group_f1 = float(f1_score(yg_test, yg_pred, zero_division=0))
        try:
            group_auc = float(roc_auc_score(yg_test, yg_prob))
        except Exception:
            group_auc = 0.5

    # Family holdout evaluation: unseen title families in validation split.
    fam_rng = np.random.default_rng(RANDOM_SEED)
    unique_families = np.unique(families)
    fam_rng.shuffle(unique_families)
    fam_cut = int(0.8 * len(unique_families))
    train_families = set(unique_families[:fam_cut].tolist())
    test_families = set(unique_families[fam_cut:].tolist())

    family_train_mask = np.array([f in train_families for f in families], dtype=bool)
    family_test_mask = np.array([f in test_families for f in families], dtype=bool)

    Xf_train = X[family_train_mask]
    yf_train = y_class[family_train_mask]
    Xf_test = X[family_test_mask]
    yf_test = y_class[family_test_mask]

    family_accuracy = 0.0
    family_precision = 0.0
    family_recall = 0.0
    family_f1 = 0.0
    family_auc = 0.5

    if len(Xf_train) > 0 and len(Xf_test) > 0 and len(np.unique(yf_train)) > 1 and len(np.unique(yf_test)) > 1:
        family_rf = RandomForestClassifier(
            n_estimators=220,
            max_depth=9,
            min_samples_split=4,
            min_samples_leaf=2,
            random_state=RANDOM_SEED,
            n_jobs=-1
        )
        family_rf.fit(Xf_train, yf_train)
        yf_prob = family_rf.predict_proba(Xf_test)[:, 1]
        yf_pred = (yf_prob >= 0.5).astype(int)

        family_accuracy = float(accuracy_score(yf_test, yf_pred))
        family_precision = float(precision_score(yf_test, yf_pred, zero_division=0))
        family_recall = float(recall_score(yf_test, yf_pred, zero_division=0))
        family_f1 = float(f1_score(yf_test, yf_pred, zero_division=0))
        try:
            family_auc = float(roc_auc_score(yf_test, yf_prob))
        except Exception:
            family_auc = 0.5

    # Additional K-Fold validation for a less optimistic performance estimate.
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
    fold_f1 = []
    fold_auc = []
    fold_acc = []
    for tr_idx, va_idx in skf.split(X, y_class):
        fold_rf = RandomForestClassifier(
            n_estimators=180,
            max_depth=9,
            min_samples_split=4,
            min_samples_leaf=2,
            random_state=RANDOM_SEED,
            n_jobs=-1
        )
        fold_rf.fit(X[tr_idx], y_class[tr_idx])
        va_prob = fold_rf.predict_proba(X[va_idx])[:, 1]
        va_pred = (va_prob >= 0.5).astype(int)
        fold_acc.append(float(accuracy_score(y_class[va_idx], va_pred)))
        fold_f1.append(float(f1_score(y_class[va_idx], va_pred, zero_division=0)))
        try:
            fold_auc.append(float(roc_auc_score(y_class[va_idx], va_prob)))
        except Exception:
            fold_auc.append(0.5)

    payload = {
        'rf': rf,
        'gbr': gbr,
        'xgb': xgb,
        'vectorizer': vectorizer,
        'jobs': jobs,
        'tfidf_matrix': tfidf_matrix,
        'metrics': {
            'accuracy': round(accuracy, 4),
            'precision': round(precision, 4),
            'recall': round(recall, 4),
            'f1': round(f1, 4),
            'auc': round(auc, 4),
            'group_holdout_accuracy': round(group_accuracy, 4),
            'group_holdout_precision': round(group_precision, 4),
            'group_holdout_recall': round(group_recall, 4),
            'group_holdout_f1': round(group_f1, 4),
            'group_holdout_auc': round(group_auc, 4),
            'family_holdout_accuracy': round(family_accuracy, 4),
            'family_holdout_precision': round(family_precision, 4),
            'family_holdout_recall': round(family_recall, 4),
            'family_holdout_f1': round(family_f1, 4),
            'family_holdout_auc': round(family_auc, 4),
            'cv_accuracy_mean': round(float(np.mean(fold_acc)), 4),
            'cv_f1_mean': round(float(np.mean(fold_f1)), 4),
            'cv_auc_mean': round(float(np.mean(fold_auc)), 4),
            'ranker': 'xgboost' if xgb is not None else 'gradient_boosting'
        }
    }

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(payload, model_path)
    return payload


def ensure_model(model_path=MODEL_PATH, dataset_path=DATASET_PATH):
    if model_path.exists():
        return joblib.load(model_path)
    return train_models(dataset_path=dataset_path, model_path=model_path)


def recommend(user_skills, experience_level='Entry Level', desired_salary=None, top_n=10,
              min_salary=None, max_salary=None, strict_experience=False,
              dataset_path=DATASET_PATH, model_path=MODEL_PATH):
    model = ensure_model(model_path=model_path, dataset_path=dataset_path)

    rf = model['rf']
    gbr = model['gbr']
    xgb = model['xgb']
    vectorizer = model['vectorizer']
    jobs = model['jobs']
    tfidf_matrix = model['tfidf_matrix']

    user_skill_norm = [normalize_skill(s) for s in user_skills]
    user_text = ' '.join(user_skill_norm)
    user_vec = vectorizer.transform([user_text])
    cosine_scores = cosine_similarity(user_vec, tfidf_matrix).ravel()

    rows = []
    for idx, job in enumerate(jobs):
        match = compute_match_features(user_skill_norm, job['skills'])
        exp = experience_score(experience_level, job['experienceLevel'])
        sal = salary_score(desired_salary, job.get('salary'))

        feature = np.array([
            cosine_scores[idx],
            match['skill_match_ratio'],
            match['match_count_norm'],
            exp,
            match['related_ratio'],
            sal
        ], dtype=float).reshape(1, -1)

        rf_prob = float(rf.predict_proba(feature)[0][1])
        gbr_rank = float(gbr.predict(feature)[0])
        xgb_rank = float(xgb.predict(feature)[0]) if xgb is not None else gbr_rank
        rank_score = (xgb_rank + gbr_rank) / 2.0

        salary_num = parse_salary_to_number(job.get('salary'))
        if min_salary is not None and salary_num is not None and salary_num < min_salary:
            continue
        if max_salary is not None and salary_num is not None and salary_num > max_salary:
            continue
        if strict_experience and job.get('experienceLevel') != experience_level:
            continue

        hybrid = (
            cosine_scores[idx] * 0.30
            + rf_prob * 0.30
            + rank_score * 0.30
            + exp * 0.10
        )

        rows.append({
            'title': job['title'],
            'description': job['description'],
            'company': job['company'],
            'location': job['location'],
            'requiredSkills': job['skills'],
            'experienceLevel': job['experienceLevel'],
            'salary': job.get('salary'),
            'certifications': job.get('certifications', []),
            'source': job.get('source', 'dataset'),
            'hybridScore': round(hybrid * 100, 2),
            'cosineSimilarityScore': round(float(cosine_scores[idx]) * 100, 2),
            'randomForestProbability': round(rf_prob * 100, 2),
            'gradientBoostingScore': round(gbr_rank * 100, 2),
            'xgboostScore': round(xgb_rank * 100, 2),
            'matchedSkills': match['direct'],
            'relatedSkillMatches': match['related'],
            'missingSkills': match['missing'],
            'skillMatchCount': len(match['direct']),
            'missingSkillsCount': len(match['missing']),
            'confidenceScore': round(hybrid * 100, 2)
        })

    rows.sort(key=lambda r: r['hybridScore'], reverse=True)
    rows = rows[:top_n]

    return {
        'success': True,
        'statistics': {
            'totalJobsAnalyzed': len(jobs),
            'jobsReturned': len(rows),
            'models': {
                'classifier': 'Random Forest',
                'vectorizer': 'TF-IDF + Cosine Similarity',
                'rankers': ['XGBoost' if xgb is not None else 'Gradient Boosting', 'Gradient Boosting']
            }
        },
        'evaluation': model['metrics'],
        'jobs': rows
    }


def to_json(data):
    print(json.dumps(data, ensure_ascii=True))


def main():
    parser = argparse.ArgumentParser(description='Hybrid job recommender training and inference')
    sub = parser.add_subparsers(dest='command', required=True)

    train_cmd = sub.add_parser('train')
    train_cmd.add_argument('--dataset-path', default=str(DATASET_PATH))
    train_cmd.add_argument('--model-path', default=str(MODEL_PATH))

    rec_cmd = sub.add_parser('recommend')
    rec_cmd.add_argument('--dataset-path', default=str(DATASET_PATH))
    rec_cmd.add_argument('--model-path', default=str(MODEL_PATH))
    rec_cmd.add_argument('--skills-json', required=True)
    rec_cmd.add_argument('--experience-level', default='Entry Level')
    rec_cmd.add_argument('--desired-salary', default=None)
    rec_cmd.add_argument('--top-n', type=int, default=10)
    rec_cmd.add_argument('--min-salary', type=float, default=None)
    rec_cmd.add_argument('--max-salary', type=float, default=None)
    rec_cmd.add_argument('--strict-experience', action='store_true')

    args = parser.parse_args()

    if args.command == 'train':
        payload = train_models(Path(args.dataset_path), Path(args.model_path))
        to_json({
            'success': True,
            'message': 'Model trained successfully',
            'metrics': payload['metrics'],
            'modelPath': str(Path(args.model_path))
        })
        return

    if args.command == 'recommend':
        skills = json.loads(args.skills_json)
        output = recommend(
            user_skills=skills,
            experience_level=args.experience_level,
            desired_salary=args.desired_salary,
            top_n=args.top_n,
            min_salary=args.min_salary,
            max_salary=args.max_salary,
            strict_experience=args.strict_experience,
            dataset_path=Path(args.dataset_path),
            model_path=Path(args.model_path)
        )
        to_json(output)


if __name__ == '__main__':
    main()
