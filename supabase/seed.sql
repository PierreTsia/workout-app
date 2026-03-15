-- YouTube link curation rules:
--   - Duration < 2 minutes (form demo, not full workout)
--   - Must match the exact exercise variation
--   - Prefer recognized trainers / channels (AthleanX, Jeff Nippard, Buff Dudes, Live Lean TV, Bodybuilding.com, etc.)
--   - No unrelated, full-workout, or excessively long content
INSERT INTO exercises (name, muscle_group, emoji, is_system, youtube_url, instructions, image_url, equipment, name_en, source) VALUES

  -- 1. Arnold Press Haltères (Épaules)
  ('Arnold Press Haltères', 'Épaules', '🏋️', true,
   'https://www.youtube.com/watch?v=6Z15_WdXmVw',
   '{"setup":["Asseyez-vous sur un banc avec dossier, un haltère dans chaque main.","Amenez les haltères au niveau des épaules, paumes vers vous.","Gardez le dos droit et les pieds à plat au sol."],"movement":["Poussez les haltères vers le haut en tournant les paumes vers l''avant.","Tendez les bras au-dessus de la tête sans verrouiller les coudes.","Redescendez en inversant la rotation jusqu''à la position initiale."],"breathing":["Expirez en poussant les haltères vers le haut.","Inspirez en redescendant à la position de départ."],"common_mistakes":["Arquer excessivement le dos pendant la poussée.","Utiliser un élan du corps pour monter les haltères.","Négliger la rotation complète des poignets.","Verrouiller les coudes en haut du mouvement."]}',
   'arnold-press-halteres.png', 'dumbbell', 'Arnold Shoulder Press', 'wger:20'),

  -- 2. Papillon bras tendus (Pectoraux)
  ('Papillon bras tendus', 'Pectoraux', '🦅', true,
   'https://www.youtube.com/watch?v=iaFzPXaPLHo',
   '{"setup":["Asseyez-vous sur la machine, dos bien plaqué contre le dossier.","Saisissez les poignées avec les bras quasi tendus à hauteur d''épaules.","Réglez le siège pour aligner les bras avec le milieu de la poitrine."],"movement":["Rapprochez les poignées devant vous en contractant les pectoraux.","Maintenez une légère flexion des coudes durant tout le mouvement.","Revenez lentement en ouvrant les bras sans dépasser l''alignement des épaules."],"breathing":["Expirez en rapprochant les poignées.","Inspirez en ouvrant les bras."],"common_mistakes":["Décoller le dos du dossier pendant l''effort.","Ouvrir les bras trop loin en arrière, ce qui stresse les épaules.","Utiliser l''élan au lieu de contrôler le mouvement."]}',
   'papillon-bras-tendus.png', 'machine', 'Pec Deck', 'wger:1904'),

  -- 3. Élévations latérales (Épaules)
  ('Élévations latérales', 'Épaules', '🙆', true,
   'https://www.youtube.com/watch?v=HeovYNoZDRg',
   '{"setup":["Debout, pieds écartés à largeur d''épaules, un haltère dans chaque main.","Gardez les bras le long du corps, paumes tournées vers les cuisses.","Fléchissez légèrement les genoux et gardez le buste droit."],"movement":["Levez les bras sur les côtés jusqu''à la hauteur des épaules.","Gardez une légère flexion des coudes tout au long du mouvement.","Redescendez lentement sans laisser tomber les haltères."],"breathing":["Expirez en montant les bras.","Inspirez en redescendant."],"common_mistakes":["Monter les épaules vers les oreilles (les trapèzes prennent le relais).","Balancer le corps pour donner de l''élan.","Lever les bras au-dessus de la ligne des épaules.","Utiliser des haltères trop lourds."]}',
   'elevations-laterales.png', 'dumbbell', 'Lateral Raises', 'wger:348'),

  -- 4. Skull Crusher incliné (Triceps)
  ('Skull Crusher incliné', 'Triceps', '💀', true,
   'https://www.youtube.com/watch?v=-h6KL7ierzc',
   '{"setup":["Allongez-vous sur un banc incliné à 30-45 degrés.","Tenez la barre ou les haltères bras tendus au-dessus de la poitrine.","Serrez les coudes à largeur d''épaules, pieds au sol."],"movement":["Fléchissez les coudes pour descendre la charge vers le front.","Gardez les coudes immobiles, seuls les avant-bras bougent.","Remontez en tendant les bras complètement."],"breathing":["Inspirez en descendant la charge.","Expirez en poussant vers le haut."],"common_mistakes":["Écarter les coudes pendant le mouvement.","Descendre la charge trop vite sans contrôle.","Utiliser l''élan des épaules pour remonter."]}',
   'skull-crusher-incline.png', 'ez_bar', 'Incline Skull Crush', 'wger:911'),

  -- 5. Presse à cuisse (Quadriceps)
  ('Presse à cuisse', 'Quadriceps', '🦵', true,
   'https://www.youtube.com/watch?v=jA9tsYbA7Ms',
   '{"setup":["Asseyez-vous sur la machine, dos et tête contre le dossier.","Placez les pieds au milieu de la plateforme, écartés largeur d''épaules.","Orteils légèrement tournés vers l''extérieur."],"movement":["Fléchissez les genoux pour descendre la plateforme à environ 90 degrés.","Poussez avec les talons pour remonter sans verrouiller les genoux.","Contrôlez la descente lentement."],"breathing":["Inspirez en descendant la plateforme.","Expirez en poussant vers le haut."],"common_mistakes":["Décoller les hanches ou le dos du siège.","Verrouiller complètement les genoux en haut.","Descendre trop bas, ce qui arrondit le bas du dos.","Pousser sur les orteils au lieu des talons."]}',
   'presse-a-cuisse.png', 'machine', 'Leg Press', 'wger:371'),

  -- 6. Élévation mollet machine (Mollets)
  ('Élévation mollet machine', 'Mollets', '🦶', true,
   'https://www.youtube.com/watch?v=MAMzF7iZNkc',
   '{"setup":["Placez-vous debout dans la machine, épaules sous les coussinets.","Positionnez l''avant des pieds sur le bord de la plateforme.","Gardez les jambes quasi tendues et le dos droit."],"movement":["Montez sur la pointe des pieds le plus haut possible.","Maintenez la contraction en haut pendant une seconde.","Redescendez lentement les talons sous le niveau de la plateforme."],"breathing":["Expirez en montant sur les pointes.","Inspirez en redescendant."],"common_mistakes":["Fléchir les genoux pendant le mouvement.","Rebondir en bas sans contrôler la descente.","Ne pas utiliser toute l''amplitude du mouvement."]}',
   'elevation-mollet-machine.png', 'machine', 'Standing Calf Raises', 'wger:622'),

  -- 7. Crunch assis machine (Abdos)
  ('Crunch assis machine', 'Abdos', '🔥', true,
   'https://www.youtube.com/watch?v=CNHS2OoUi30',
   '{"setup":["Asseyez-vous sur la machine, pieds calés sous les rouleaux.","Saisissez les poignées au niveau de la tête.","Ajustez le siège pour que l''axe de rotation soit au niveau de la taille."],"movement":["Enroulez le buste vers l''avant en contractant les abdominaux.","Maintenez la contraction une seconde en fin de mouvement.","Revenez lentement en position initiale en résistant à la charge."],"breathing":["Expirez en enroulant le buste.","Inspirez en revenant en position initiale."],"common_mistakes":["Tirer avec les bras au lieu de contracter les abdos.","Utiliser l''élan pour descendre.","Choisir une charge trop lourde qui empêche un bon enroulement."]}',
   'crunch-assis-machine.png', 'machine', 'Crunches on Machine', 'wger:172'),

  -- 8. Rangées prise serrée neutre (Dos)
  ('Rangées prise serrée neutre', 'Dos', '🚣', true,
   'https://www.youtube.com/watch?v=xjlz8lRXOOI',
   '{"setup":["Asseyez-vous face à la machine, poitrine contre le support.","Saisissez les poignées en prise neutre (paumes face à face).","Gardez le dos droit et les pieds bien ancrés au sol."],"movement":["Tirez les poignées vers l''abdomen en serrant les omoplates.","Gardez les coudes près du corps pendant le tirage.","Revenez lentement bras quasi tendus sans relâcher la tension."],"breathing":["Expirez en tirant les poignées vers vous.","Inspirez en revenant à la position de départ."],"common_mistakes":["Arrondir le dos pendant le tirage.","Donner un élan avec le buste pour tricher.","Tirer uniquement avec les bras sans engager le dos.","Tendre complètement les bras en fin d''extension."]}',
   'rangees-prise-serree-neutre.png', 'machine', 'Rowing Seated Narrow Grip', 'wger:512'),

  -- 9. Rangées prise large pronation (Dos)
  ('Rangées prise large pronation', 'Dos', '💪', true,
   'https://www.youtube.com/watch?v=y7h823PdWIY',
   '{"setup":["Asseyez-vous face à la machine, poitrine contre le support.","Saisissez les poignées larges en pronation (paumes vers le bas).","Ajustez le siège pour avoir les bras parallèles au sol."],"movement":["Tirez les poignées vers la poitrine en écartant les coudes.","Serrez les omoplates en fin de mouvement.","Revenez lentement sans tendre complètement les bras."],"breathing":["Expirez en tirant vers vous.","Inspirez en relâchant vers l''avant."],"common_mistakes":["Pencher le buste vers l''arrière pour tricher.","Fermer les coudes au lieu de les garder ouverts.","Relâcher brutalement la charge en retour."]}',
   'rangees-prise-large-pronation.png', 'machine', 'Seated Cable Row', 'wger:1117'),

  -- 10. Curls biceps inclinés (Biceps)
  ('Curls biceps inclinés', 'Biceps', '💪', true,
   'https://www.youtube.com/watch?v=b4jOP-spQW8',
   '{"setup":["Réglez le banc incliné à 45 degrés.","Asseyez-vous dos bien plaqué, un haltère dans chaque main.","Laissez pendre les bras, paumes vers l''avant."],"movement":["Fléchissez les coudes pour monter les haltères vers les épaules.","Gardez les coudes immobiles, seuls les avant-bras bougent.","Redescendez lentement pendant 2 à 3 secondes."],"breathing":["Expirez en montant les haltères.","Inspirez en les redescendant."],"common_mistakes":["Avancer les coudes pendant la montée.","Balancer le corps pour aider à soulever.","Descendre trop vite sans phase excentrique.","Ne pas descendre jusqu''à l''extension complète."]}',
   'curls-biceps-inclines.png', 'dumbbell', 'Dumbbell Incline Curl', 'wger:204'),

  -- 11. Papillon inverse (Deltoïdes post.)
  ('Papillon inverse', 'Deltoïdes post.', '🦅', true,
   'https://www.youtube.com/watch?v=Y7ZKBP5bMwg',
   '{"setup":["Asseyez-vous face au dossier de la machine à papillon.","Saisissez les poignées avec les bras à hauteur d''épaules.","Gardez le buste plaqué contre le support."],"movement":["Écartez les bras vers l''arrière en serrant les omoplates.","Maintenez la contraction une seconde en fin de mouvement.","Revenez lentement sans laisser les poids se reposer."],"breathing":["Expirez en écartant les bras.","Inspirez en revenant."],"common_mistakes":["Décoller la poitrine du support.","Utiliser trop de poids et compenser avec le dos.","Faire un mouvement trop rapide sans contrôle."]}',
   'papillon-inverse.png', 'machine', 'Pec Deck Rear Delt Fly', 'wger:1775'),

  -- 12. Shrugs haltères (Trapèzes)
  ('Shrugs haltères', 'Trapèzes', '🤷', true,
   'https://www.youtube.com/watch?v=nwSmkoHM-Jw',
   '{"setup":["Debout, pieds largeur d''épaules, un haltère dans chaque main.","Bras le long du corps, paumes tournées vers les cuisses.","Gardez le dos droit et le regard devant vous."],"movement":["Montez les épaules vers les oreilles le plus haut possible.","Maintenez la contraction en haut une seconde.","Redescendez lentement les épaules en position initiale."],"breathing":["Expirez en montant les épaules.","Inspirez en redescendant."],"common_mistakes":["Faire des rotations avec les épaules (risque de blessure).","Fléchir les coudes pour aider à monter.","Pencher la tête vers l''avant.","Utiliser l''élan pour soulever."]}',
   'shrugs-halteres.png', 'dumbbell', 'Dumbbell Shrug', 'wger:1645'),

  -- 13. Soulevé de terre roumain (Ischios / Bas du dos)
  ('Soulevé de terre roumain', 'Ischios / Bas du dos', '🏋️', true,
   'https://www.youtube.com/watch?v=5jO4u1HFkTA',
   '{"setup":["Debout, pieds largeur de bassin, barre ou haltères en mains.","Tirez les épaules en arrière et bombez légèrement la poitrine.","Fléchissez légèrement les genoux."],"movement":["Penchez le buste vers l''avant en poussant les fesses vers l''arrière.","Descendez la charge le long des jambes, dos toujours droit.","Remontez en contractant les fessiers et les ischio-jambiers."],"breathing":["Inspirez en descendant.","Expirez en remontant."],"common_mistakes":["Arrondir le bas du dos pendant la descente.","Garder les jambes complètement tendues.","Éloigner la barre du corps.","Descendre trop bas au-delà de la souplesse naturelle."]}',
   'souleve-de-terre-roumain.png', 'barbell', 'Romanian Deadlift', 'wger:1750'),

  -- 14. Extension du dos machine (Lombaires)
  ('Extension du dos machine', 'Lombaires', '🔙', true,
   'https://www.youtube.com/watch?v=iSIFVCzzNOY',
   '{"setup":["Asseyez-vous sur la machine, dos contre le coussin mobile.","Calez les pieds sur les repose-pieds.","Réglez la machine pour que les hanches soient à environ 90 degrés."],"movement":["Poussez le coussin vers l''arrière en contractant les lombaires.","Maintenez la position une seconde en extension.","Revenez lentement en position initiale sans relâcher la tension."],"breathing":["Expirez en poussant vers l''arrière.","Inspirez en revenant."],"common_mistakes":["Aller trop loin en hyperextension du dos.","Faire le mouvement trop rapidement.","Utiliser une charge trop lourde."]}',
   'extension-du-dos-machine.png', 'machine', 'Hyperextensions', 'wger:301'),

  -- 15. Crunch à genoux poulie (Abdos)
  ('Crunch à genoux poulie', 'Abdos', '🔥', true,
   'https://www.youtube.com/watch?v=NJQROeaBiVE',
   '{"setup":["Agenouillez-vous sous la poulie haute, face à la machine.","Saisissez la corde et placez les mains de chaque côté de la tête.","Gardez les hanches fixes au-dessus des genoux."],"movement":["Enroulez le buste vers le bas en contractant fortement les abdominaux.","Rapprochez les coudes des genoux sans bouger les hanches.","Remontez lentement en résistant à la charge."],"breathing":["Expirez en enroulant le buste.","Inspirez en remontant."],"common_mistakes":["Tirer avec les bras au lieu des abdominaux.","Bouger les hanches pour tricher.","Ne pas enrouler le dos (flexion du tronc insuffisante).","S''asseoir sur les talons au lieu de rester droit."]}',
   'crunch-a-genoux-poulie.png', 'cable', 'Crunches With Cable', 'wger:173'),

  -- 16. Développé couché (Pectoraux)
  ('Développé couché', 'Pectoraux', '🏋️', true,
   'https://www.youtube.com/watch?v=0cXAp6WhSj4',
   '{"setup":["Allongez-vous sur le banc, yeux sous la barre.","Saisissez la barre un peu plus large que les épaules.","Serrez les omoplates et posez les pieds à plat au sol."],"movement":["Décrochez la barre et descendez-la vers le bas des pectoraux.","Gardez les coudes à environ 45 degrés du corps.","Poussez la barre vers le haut jusqu''à l''extension des bras."],"breathing":["Inspirez en descendant la barre.","Expirez en poussant."],"common_mistakes":["Rebondir la barre sur la poitrine.","Écarter les coudes à 90 degrés (stresse les épaules).","Décoller les fesses du banc.","Ne pas serrer les omoplates."]}',
   'developpe-couche.png', 'barbell', 'Bench Press', 'wger:73'),

  -- 17. Tirage latéral prise large (Dos)
  ('Tirage latéral prise large', 'Dos', '🚣', true,
   'https://www.youtube.com/watch?v=lueEJGjTuPQ',
   '{"setup":["Asseyez-vous face à la machine, cuisses calées sous les rouleaux.","Saisissez la barre large en pronation (paumes vers l''avant).","Gardez le buste droit et la poitrine sortie."],"movement":["Tirez la barre vers le haut de la poitrine en dirigeant les coudes vers le bas.","Serrez les omoplates en fin de mouvement.","Remontez la barre lentement bras quasi tendus."],"breathing":["Expirez en tirant la barre vers vous.","Inspirez en remontant la barre."],"common_mistakes":["Tirer la barre derrière la nuque (danger pour les épaules).","Se pencher excessivement en arrière.","Tirer uniquement avec les bras sans engager les dorsaux.","Verrouiller les coudes en haut du mouvement."]}',
   'tirage-lateral-prise-large.png', 'cable', 'Lat Pulldown Wide Grip', 'wger:1697'),

  -- 18. Pec Deck bras tendus (Pectoraux)
  ('Pec Deck bras tendus', 'Pectoraux', '🦅', true,
   'https://www.youtube.com/watch?v=iaFzPXaPLHo',
   '{"setup":["Asseyez-vous sur la machine, dos bien plaqué contre le dossier.","Saisissez les poignées bras tendus à hauteur de poitrine.","Réglez le siège pour aligner les bras avec le milieu des pectoraux."],"movement":["Rapprochez les poignées devant vous en serrant les pectoraux.","Maintenez la contraction une seconde, bras quasi tendus.","Revenez lentement sans dépasser l''alignement des épaules."],"breathing":["Expirez en fermant les bras.","Inspirez en les ouvrant."],"common_mistakes":["Décoller le dos du dossier.","Fléchir les coudes au lieu de garder les bras tendus.","Ouvrir les bras trop loin en arrière."]}',
   'pec-deck-bras-tendus.png', 'machine', 'Pec Deck', NULL),

  -- 19. Extension triceps corde (Triceps)
  ('Extension triceps corde', 'Triceps', '💪', true,
   'https://www.youtube.com/watch?v=5Yv-2CCMqxM',
   '{"setup":["Debout face à la poulie haute, saisissez la corde à deux mains.","Gardez les coudes collés au corps, avant-bras parallèles au sol.","Pieds largeur d''épaules, genoux légèrement fléchis."],"movement":["Poussez la corde vers le bas en tendant les bras.","Écartez les extrémités de la corde en bas du mouvement.","Remontez lentement jusqu''à ce que les avant-bras soient parallèles au sol."],"breathing":["Expirez en poussant vers le bas.","Inspirez en remontant."],"common_mistakes":["Décoller les coudes du corps.","Pencher le buste vers l''avant pour tricher.","Remonter les mains plus haut que la position de départ.","Utiliser un poids trop lourd qui empêche l''extension complète."]}',
   'extension-triceps-corde.png', 'cable', 'Tricep Rope Pushdowns', 'wger:1900'),

  -- 20. Curls stricts barre (Biceps)
  ('Curls stricts barre', 'Biceps', '🦾', true,
   'https://www.youtube.com/watch?v=rXfGNkxUZks',
   '{"setup":["Debout, pieds largeur d''épaules, barre en mains, paumes vers l''avant.","Dos droit, épaules en arrière, coudes le long du corps.","Gardez le corps parfaitement immobile."],"movement":["Fléchissez les coudes pour monter la barre vers les épaules.","Gardez les coudes fixes et le dos droit, sans tricher.","Redescendez lentement jusqu''à l''extension complète des bras."],"breathing":["Expirez en montant la barre.","Inspirez en redescendant."],"common_mistakes":["Balancer le buste d''avant en arrière.","Avancer les coudes pour faciliter la montée.","Descendre trop vite sans phase excentrique.","Utiliser un poids trop lourd qui force à tricher."]}',
   'curls-stricts-barre.png', 'barbell', 'Biceps Curls With Barbell', 'wger:91'),

  -- 21. Extension de jambe machine (Quadriceps)
  ('Extension de jambe machine', 'Quadriceps', '🦵', true,
   'https://www.youtube.com/watch?v=gI0cn4DMFFI',
   '{"setup":["Asseyez-vous sur la machine, dos collé au dossier.","Placez le coussin juste au-dessus des chevilles.","Alignez l''axe de rotation de la machine avec vos genoux."],"movement":["Tendez les jambes en contractant les quadriceps.","Maintenez la contraction une seconde en haut.","Redescendez lentement sans laisser retomber la charge."],"breathing":["Expirez en tendant les jambes.","Inspirez en redescendant."],"common_mistakes":["Donner un élan pour soulever la charge.","Décoller les fesses du siège.","Verrouiller brutalement les genoux en extension.","Descendre trop vite sans contrôle."]}',
   'extension-de-jambe-machine.png', 'machine', 'Leg Extension', 'wger:369'),

  -- 22. Leg Curl assis (Ischios)
  ('Leg Curl assis', 'Ischios', '🦵', true,
   'https://www.youtube.com/watch?v=Ne5MBQdvUwA',
   '{"setup":["Asseyez-vous sur la machine, dos contre le dossier.","Placez les chevilles devant le rouleau inférieur.","Calez les cuisses sous le coussin de maintien."],"movement":["Fléchissez les genoux pour ramener les talons sous les cuisses.","Maintenez la contraction des ischio-jambiers une seconde.","Remontez lentement sans tendre complètement les jambes."],"breathing":["Expirez en fléchissant les jambes.","Inspirez en revenant."],"common_mistakes":["Lever les hanches du siège pendant l''effort.","Utiliser l''élan pour descendre la charge.","Relâcher trop vite en phase de retour.","Cambrer le bas du dos."]}',
   'leg-curl-assis.png', 'machine', 'Leg Curls Sitting', 'wger:366'),

  -- 23. Extension mollet machine (Mollets)
  ('Extension mollet machine', 'Mollets', '🦶', true,
   'https://www.youtube.com/watch?v=SVmM6a0dHGU',
   '{"setup":["Asseyez-vous sur la machine à mollets, genoux sous les coussinets.","Placez l''avant des pieds sur la plateforme, talons dans le vide.","Gardez le dos droit et les mains sur les poignées."],"movement":["Poussez sur les orteils pour lever les talons le plus haut possible.","Maintenez la contraction en haut pendant 2 secondes.","Redescendez lentement les talons sous le niveau de la plateforme."],"breathing":["Expirez en montant les talons.","Inspirez en redescendant."],"common_mistakes":["Faire des mouvements rapides et saccadés.","Ne pas descendre assez bas pour étirer le mollet.","Utiliser l''élan au lieu de contrôler la charge."]}',
   'extension-mollet-machine.png', 'machine', 'Seated Calf Raise', 'wger:1365')
ON CONFLICT (name) DO NOTHING;

-- =========================================================================
-- Additional exercises for templates & alternatives (bodyweight / dumbbell)
-- =========================================================================

INSERT INTO exercises (name, muscle_group, emoji, is_system, equipment, name_en) VALUES
  ('Pompes', 'Pectoraux', '🏋️', true, 'bodyweight', 'Push-ups'),
  ('Tractions', 'Dos', '🚣', true, 'bodyweight', 'Pull-ups'),
  ('Dips', 'Triceps', '💪', true, 'bodyweight', 'Dips'),
  ('Squat barre', 'Quadriceps', '🦵', true, 'barbell', 'Barbell Squat'),
  ('Squat au poids du corps', 'Quadriceps', '🦵', true, 'bodyweight', 'Bodyweight Squat'),
  ('Fentes haltères', 'Quadriceps', '🦵', true, 'dumbbell', 'Dumbbell Lunges'),
  ('Gainage planche', 'Abdos', '🔥', true, 'bodyweight', 'Plank'),
  ('Crunchs', 'Abdos', '🔥', true, 'bodyweight', 'Crunches'),
  ('Développé haltères', 'Pectoraux', '🏋️', true, 'dumbbell', 'Dumbbell Bench Press'),
  ('Rowing haltère', 'Dos', '🚣', true, 'dumbbell', 'Dumbbell Row'),
  ('Développé épaules haltères', 'Épaules', '🙆', true, 'dumbbell', 'Dumbbell Shoulder Press'),
  ('Curl marteau haltères', 'Biceps', '💪', true, 'dumbbell', 'Hammer Curl'),
  ('Extension triceps haltère', 'Triceps', '💪', true, 'dumbbell', 'Dumbbell Triceps Extension'),
  ('Soulevé de terre', 'Dos', '🏋️', true, 'barbell', 'Deadlift'),
  ('Hip Thrust', 'Fessiers', '🍑', true, 'barbell', 'Hip Thrust'),
  ('Élévation mollet debout', 'Mollets', '🦶', true, 'bodyweight', 'Standing Calf Raise')
ON CONFLICT (name) DO NOTHING;

-- =========================================================================
-- Program Templates
-- =========================================================================

INSERT INTO program_templates (name, description, min_days, max_days, primary_goal, experience_tags) VALUES
  ('Full Body', 'Compound-heavy full body sessions. Low volume per muscle, high frequency. Ideal for beginners building a strength base.', 2, 4, 'general_fitness', '{beginner}'),
  ('Upper/Lower', 'Balanced upper/lower split with push-pull balance. Good volume per session for hypertrophy.', 3, 4, 'hypertrophy', '{intermediate}'),
  ('PPL (Push/Pull/Legs)', 'Classic bodybuilding split. High volume, each muscle hit twice per week at 6 days.', 3, 6, 'hypertrophy', '{intermediate,advanced}'),
  ('GZCLP', 'Linear progression with heavy compounds (T1), moderate volume accessories (T2/T3). Great for building raw strength.', 3, 4, 'strength', '{beginner,intermediate}'),
  ('Muscular Endurance', 'High reps, short rest, circuit-style training. Builds muscular endurance and work capacity.', 3, 4, 'endurance', '{beginner,intermediate,advanced}')
ON CONFLICT (name) DO NOTHING;

-- =========================================================================
-- Template Days
-- =========================================================================

INSERT INTO template_days (template_id, day_label, day_number, muscle_focus, sort_order) VALUES
  -- Full Body (3 days)
  ((SELECT id FROM program_templates WHERE name = 'Full Body'), 'Full Body A', 1, 'Full body — press focus', 0),
  ((SELECT id FROM program_templates WHERE name = 'Full Body'), 'Full Body B', 2, 'Full body — hinge focus', 1),
  ((SELECT id FROM program_templates WHERE name = 'Full Body'), 'Full Body C', 3, 'Full body — unilateral focus', 2),
  -- Upper/Lower (4 days)
  ((SELECT id FROM program_templates WHERE name = 'Upper/Lower'), 'Upper A', 1, 'Chest, back, shoulders, arms', 0),
  ((SELECT id FROM program_templates WHERE name = 'Upper/Lower'), 'Lower A', 2, 'Quads, hamstrings, calves, core', 1),
  ((SELECT id FROM program_templates WHERE name = 'Upper/Lower'), 'Upper B', 3, 'Chest, back, shoulders, arms', 2),
  ((SELECT id FROM program_templates WHERE name = 'Upper/Lower'), 'Lower B', 4, 'Quads, hamstrings, calves, core', 3),
  -- PPL (6 days)
  ((SELECT id FROM program_templates WHERE name = 'PPL (Push/Pull/Legs)'), 'Push', 1, 'Chest, shoulders, triceps', 0),
  ((SELECT id FROM program_templates WHERE name = 'PPL (Push/Pull/Legs)'), 'Pull', 2, 'Back, biceps, rear delts', 1),
  ((SELECT id FROM program_templates WHERE name = 'PPL (Push/Pull/Legs)'), 'Legs', 3, 'Quads, hamstrings, calves, core', 2),
  ((SELECT id FROM program_templates WHERE name = 'PPL (Push/Pull/Legs)'), 'Push B', 4, 'Chest, shoulders, triceps', 3),
  ((SELECT id FROM program_templates WHERE name = 'PPL (Push/Pull/Legs)'), 'Pull B', 5, 'Back, biceps, rear delts', 4),
  ((SELECT id FROM program_templates WHERE name = 'PPL (Push/Pull/Legs)'), 'Legs B', 6, 'Quads, hamstrings, calves, core', 5),
  -- GZCLP (3 days)
  ((SELECT id FROM program_templates WHERE name = 'GZCLP'), 'GZCLP Day A', 1, 'Squat + bench focus', 0),
  ((SELECT id FROM program_templates WHERE name = 'GZCLP'), 'GZCLP Day B', 2, 'Deadlift + OHP focus', 1),
  ((SELECT id FROM program_templates WHERE name = 'GZCLP'), 'GZCLP Day C', 3, 'Squat + bench variation', 2),
  -- Muscular Endurance (4 days)
  ((SELECT id FROM program_templates WHERE name = 'Muscular Endurance'), 'Upper Circuit', 1, 'Upper body endurance', 0),
  ((SELECT id FROM program_templates WHERE name = 'Muscular Endurance'), 'Lower Circuit', 2, 'Lower body endurance', 1),
  ((SELECT id FROM program_templates WHERE name = 'Muscular Endurance'), 'Full Body Circuit', 3, 'Total body conditioning', 2),
  ((SELECT id FROM program_templates WHERE name = 'Muscular Endurance'), 'Conditioning', 4, 'Mixed endurance + core', 3);

-- =========================================================================
-- Template Exercises
-- =========================================================================

-- Helper: each row references (template_day via label+template, exercise via name)
-- Format: (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order)

-- ---- Full Body A ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body A'),
   (SELECT id FROM exercises WHERE name = 'Développé couché'), 3, '8-12', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body A'),
   (SELECT id FROM exercises WHERE name = 'Squat barre'), 3, '8-12', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body A'),
   (SELECT id FROM exercises WHERE name = 'Tirage latéral prise large'), 3, '8-12', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body A'),
   (SELECT id FROM exercises WHERE name = 'Élévations latérales'), 3, '12-15', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body A'),
   (SELECT id FROM exercises WHERE name = 'Crunchs'), 3, '15-20', 60, 4);

-- ---- Full Body B ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body B'),
   (SELECT id FROM exercises WHERE name = 'Développé haltères'), 3, '8-12', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body B'),
   (SELECT id FROM exercises WHERE name = 'Soulevé de terre roumain'), 3, '8-12', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body B'),
   (SELECT id FROM exercises WHERE name = 'Rowing haltère'), 3, '8-12', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body B'),
   (SELECT id FROM exercises WHERE name = 'Arnold Press Haltères'), 3, '8-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body B'),
   (SELECT id FROM exercises WHERE name = 'Gainage planche'), 3, '30-60s', 60, 4);

-- ---- Full Body C ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body C'),
   (SELECT id FROM exercises WHERE name = 'Pompes'), 3, '10-15', 60, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body C'),
   (SELECT id FROM exercises WHERE name = 'Fentes haltères'), 3, '10-12', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body C'),
   (SELECT id FROM exercises WHERE name = 'Rangées prise serrée neutre'), 3, '8-12', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body C'),
   (SELECT id FROM exercises WHERE name = 'Élévations latérales'), 3, '12-15', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Full Body' AND td.day_label = 'Full Body C'),
   (SELECT id FROM exercises WHERE name = 'Crunch assis machine'), 3, '12-15', 60, 4);

-- ---- Upper A ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Upper A'),
   (SELECT id FROM exercises WHERE name = 'Développé couché'), 4, '8-10', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Upper A'),
   (SELECT id FROM exercises WHERE name = 'Tirage latéral prise large'), 4, '8-10', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Upper A'),
   (SELECT id FROM exercises WHERE name = 'Arnold Press Haltères'), 3, '10-12', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Upper A'),
   (SELECT id FROM exercises WHERE name = 'Rangées prise serrée neutre'), 3, '10-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Upper A'),
   (SELECT id FROM exercises WHERE name = 'Extension triceps corde'), 3, '10-12', 60, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Upper A'),
   (SELECT id FROM exercises WHERE name = 'Curls stricts barre'), 3, '10-12', 60, 5);

-- ---- Lower A ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Lower A'),
   (SELECT id FROM exercises WHERE name = 'Squat barre'), 4, '6-8', 120, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Lower A'),
   (SELECT id FROM exercises WHERE name = 'Soulevé de terre roumain'), 3, '8-10', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Lower A'),
   (SELECT id FROM exercises WHERE name = 'Presse à cuisse'), 3, '10-12', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Lower A'),
   (SELECT id FROM exercises WHERE name = 'Leg Curl assis'), 3, '10-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Lower A'),
   (SELECT id FROM exercises WHERE name = 'Élévation mollet machine'), 4, '12-15', 60, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Lower A'),
   (SELECT id FROM exercises WHERE name = 'Crunch assis machine'), 3, '12-15', 60, 5);

-- ---- Upper B ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Upper B'),
   (SELECT id FROM exercises WHERE name = 'Développé haltères'), 4, '8-10', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Upper B'),
   (SELECT id FROM exercises WHERE name = 'Rangées prise large pronation'), 4, '8-10', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Upper B'),
   (SELECT id FROM exercises WHERE name = 'Élévations latérales'), 3, '12-15', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Upper B'),
   (SELECT id FROM exercises WHERE name = 'Papillon inverse'), 3, '12-15', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Upper B'),
   (SELECT id FROM exercises WHERE name = 'Skull Crusher incliné'), 3, '10-12', 60, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Upper B'),
   (SELECT id FROM exercises WHERE name = 'Curls biceps inclinés'), 3, '10-12', 60, 5);

-- ---- Lower B ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Lower B'),
   (SELECT id FROM exercises WHERE name = 'Presse à cuisse'), 4, '8-10', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Lower B'),
   (SELECT id FROM exercises WHERE name = 'Soulevé de terre roumain'), 3, '10-12', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Lower B'),
   (SELECT id FROM exercises WHERE name = 'Extension de jambe machine'), 3, '12-15', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Lower B'),
   (SELECT id FROM exercises WHERE name = 'Leg Curl assis'), 3, '12-15', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Lower B'),
   (SELECT id FROM exercises WHERE name = 'Extension mollet machine'), 4, '12-15', 60, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Upper/Lower' AND td.day_label = 'Lower B'),
   (SELECT id FROM exercises WHERE name = 'Crunch à genoux poulie'), 3, '12-15', 60, 5);

-- ---- PPL Push ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Push'),
   (SELECT id FROM exercises WHERE name = 'Développé couché'), 4, '6-8', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Push'),
   (SELECT id FROM exercises WHERE name = 'Papillon bras tendus'), 3, '10-12', 60, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Push'),
   (SELECT id FROM exercises WHERE name = 'Arnold Press Haltères'), 3, '8-10', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Push'),
   (SELECT id FROM exercises WHERE name = 'Élévations latérales'), 3, '12-15', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Push'),
   (SELECT id FROM exercises WHERE name = 'Skull Crusher incliné'), 3, '10-12', 60, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Push'),
   (SELECT id FROM exercises WHERE name = 'Extension triceps corde'), 3, '12-15', 60, 5);

-- ---- PPL Pull ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Pull'),
   (SELECT id FROM exercises WHERE name = 'Tirage latéral prise large'), 4, '6-8', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Pull'),
   (SELECT id FROM exercises WHERE name = 'Rangées prise serrée neutre'), 3, '8-10', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Pull'),
   (SELECT id FROM exercises WHERE name = 'Papillon inverse'), 3, '12-15', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Pull'),
   (SELECT id FROM exercises WHERE name = 'Shrugs haltères'), 3, '10-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Pull'),
   (SELECT id FROM exercises WHERE name = 'Curls stricts barre'), 3, '8-10', 60, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Pull'),
   (SELECT id FROM exercises WHERE name = 'Curls biceps inclinés'), 3, '10-12', 60, 5);

-- ---- PPL Legs ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Legs'),
   (SELECT id FROM exercises WHERE name = 'Squat barre'), 4, '6-8', 120, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Legs'),
   (SELECT id FROM exercises WHERE name = 'Presse à cuisse'), 3, '10-12', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Legs'),
   (SELECT id FROM exercises WHERE name = 'Soulevé de terre roumain'), 3, '8-10', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Legs'),
   (SELECT id FROM exercises WHERE name = 'Leg Curl assis'), 3, '10-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Legs'),
   (SELECT id FROM exercises WHERE name = 'Élévation mollet machine'), 4, '12-15', 60, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Legs'),
   (SELECT id FROM exercises WHERE name = 'Crunch assis machine'), 3, '12-15', 60, 5);

-- ---- PPL Push B ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Push B'),
   (SELECT id FROM exercises WHERE name = 'Développé haltères'), 4, '8-10', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Push B'),
   (SELECT id FROM exercises WHERE name = 'Pec Deck bras tendus'), 3, '10-12', 60, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Push B'),
   (SELECT id FROM exercises WHERE name = 'Développé épaules haltères'), 3, '8-10', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Push B'),
   (SELECT id FROM exercises WHERE name = 'Élévations latérales'), 3, '12-15', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Push B'),
   (SELECT id FROM exercises WHERE name = 'Extension triceps corde'), 3, '12-15', 60, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Push B'),
   (SELECT id FROM exercises WHERE name = 'Dips'), 3, '8-12', 60, 5);

-- ---- PPL Pull B ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Pull B'),
   (SELECT id FROM exercises WHERE name = 'Rangées prise large pronation'), 4, '8-10', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Pull B'),
   (SELECT id FROM exercises WHERE name = 'Tractions'), 3, '6-10', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Pull B'),
   (SELECT id FROM exercises WHERE name = 'Papillon inverse'), 3, '12-15', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Pull B'),
   (SELECT id FROM exercises WHERE name = 'Shrugs haltères'), 3, '10-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Pull B'),
   (SELECT id FROM exercises WHERE name = 'Curl marteau haltères'), 3, '10-12', 60, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Pull B'),
   (SELECT id FROM exercises WHERE name = 'Curls biceps inclinés'), 3, '12-15', 60, 5);

-- ---- PPL Legs B ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Legs B'),
   (SELECT id FROM exercises WHERE name = 'Presse à cuisse'), 4, '8-10', 90, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Legs B'),
   (SELECT id FROM exercises WHERE name = 'Fentes haltères'), 3, '10-12', 90, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Legs B'),
   (SELECT id FROM exercises WHERE name = 'Extension de jambe machine'), 3, '12-15', 60, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Legs B'),
   (SELECT id FROM exercises WHERE name = 'Leg Curl assis'), 3, '12-15', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Legs B'),
   (SELECT id FROM exercises WHERE name = 'Extension mollet machine'), 4, '15-20', 45, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'PPL (Push/Pull/Legs)' AND td.day_label = 'Legs B'),
   (SELECT id FROM exercises WHERE name = 'Crunch à genoux poulie'), 3, '12-15', 60, 5);

-- ---- GZCLP Day A (Squat T1 + Bench T2) ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day A'),
   (SELECT id FROM exercises WHERE name = 'Squat barre'), 5, '3-5', 180, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day A'),
   (SELECT id FROM exercises WHERE name = 'Développé couché'), 3, '8-10', 120, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day A'),
   (SELECT id FROM exercises WHERE name = 'Tirage latéral prise large'), 3, '8-12', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day A'),
   (SELECT id FROM exercises WHERE name = 'Élévations latérales'), 3, '12-15', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day A'),
   (SELECT id FROM exercises WHERE name = 'Crunch à genoux poulie'), 3, '10-15', 60, 4);

-- ---- GZCLP Day B (Deadlift T1 + OHP T2) ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day B'),
   (SELECT id FROM exercises WHERE name = 'Soulevé de terre'), 5, '3-5', 180, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day B'),
   (SELECT id FROM exercises WHERE name = 'Arnold Press Haltères'), 3, '8-10', 120, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day B'),
   (SELECT id FROM exercises WHERE name = 'Rangées prise serrée neutre'), 3, '8-12', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day B'),
   (SELECT id FROM exercises WHERE name = 'Curls stricts barre'), 3, '8-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day B'),
   (SELECT id FROM exercises WHERE name = 'Extension triceps corde'), 3, '10-12', 60, 4);

-- ---- GZCLP Day C (Bench T1 + Squat T2) ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day C'),
   (SELECT id FROM exercises WHERE name = 'Développé couché'), 5, '3-5', 180, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day C'),
   (SELECT id FROM exercises WHERE name = 'Squat barre'), 3, '8-10', 120, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day C'),
   (SELECT id FROM exercises WHERE name = 'Rangées prise large pronation'), 3, '8-12', 90, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day C'),
   (SELECT id FROM exercises WHERE name = 'Curls biceps inclinés'), 3, '10-12', 60, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'GZCLP' AND td.day_label = 'GZCLP Day C'),
   (SELECT id FROM exercises WHERE name = 'Skull Crusher incliné'), 3, '10-12', 60, 4);

-- ---- Muscular Endurance — Upper Circuit ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Upper Circuit'),
   (SELECT id FROM exercises WHERE name = 'Pompes'), 3, '15-20', 30, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Upper Circuit'),
   (SELECT id FROM exercises WHERE name = 'Rowing haltère'), 3, '15-20', 30, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Upper Circuit'),
   (SELECT id FROM exercises WHERE name = 'Développé épaules haltères'), 3, '15-20', 30, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Upper Circuit'),
   (SELECT id FROM exercises WHERE name = 'Élévations latérales'), 3, '15-20', 30, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Upper Circuit'),
   (SELECT id FROM exercises WHERE name = 'Extension triceps haltère'), 3, '15-20', 30, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Upper Circuit'),
   (SELECT id FROM exercises WHERE name = 'Curl marteau haltères'), 3, '15-20', 30, 5);

-- ---- Muscular Endurance — Lower Circuit ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Lower Circuit'),
   (SELECT id FROM exercises WHERE name = 'Fentes haltères'), 3, '15-20', 30, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Lower Circuit'),
   (SELECT id FROM exercises WHERE name = 'Presse à cuisse'), 3, '15-20', 30, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Lower Circuit'),
   (SELECT id FROM exercises WHERE name = 'Leg Curl assis'), 3, '15-20', 30, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Lower Circuit'),
   (SELECT id FROM exercises WHERE name = 'Extension de jambe machine'), 3, '15-20', 30, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Lower Circuit'),
   (SELECT id FROM exercises WHERE name = 'Élévation mollet machine'), 3, '20-25', 30, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Lower Circuit'),
   (SELECT id FROM exercises WHERE name = 'Gainage planche'), 3, '30-60s', 30, 5);

-- ---- Muscular Endurance — Full Body Circuit ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Full Body Circuit'),
   (SELECT id FROM exercises WHERE name = 'Développé haltères'), 3, '15-20', 30, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Full Body Circuit'),
   (SELECT id FROM exercises WHERE name = 'Squat au poids du corps'), 3, '20-25', 30, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Full Body Circuit'),
   (SELECT id FROM exercises WHERE name = 'Tractions'), 3, '8-12', 30, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Full Body Circuit'),
   (SELECT id FROM exercises WHERE name = 'Élévations latérales'), 3, '15-20', 30, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Full Body Circuit'),
   (SELECT id FROM exercises WHERE name = 'Crunchs'), 3, '20-25', 30, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Full Body Circuit'),
   (SELECT id FROM exercises WHERE name = 'Élévation mollet debout'), 3, '20-25', 30, 5);

-- ---- Muscular Endurance — Conditioning ----
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order) VALUES
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Conditioning'),
   (SELECT id FROM exercises WHERE name = 'Soulevé de terre roumain'), 3, '15-20', 45, 0),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Conditioning'),
   (SELECT id FROM exercises WHERE name = 'Pompes'), 3, '15-20', 30, 1),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Conditioning'),
   (SELECT id FROM exercises WHERE name = 'Fentes haltères'), 3, '15-20', 30, 2),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Conditioning'),
   (SELECT id FROM exercises WHERE name = 'Rowing haltère'), 3, '15-20', 30, 3),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Conditioning'),
   (SELECT id FROM exercises WHERE name = 'Crunch assis machine'), 3, '15-20', 30, 4),
  ((SELECT td.id FROM template_days td JOIN program_templates pt ON td.template_id = pt.id WHERE pt.name = 'Muscular Endurance' AND td.day_label = 'Conditioning'),
   (SELECT id FROM exercises WHERE name = 'Extension mollet machine'), 3, '20-25', 30, 5);

-- =========================================================================
-- Exercise Alternatives (gym → home/minimal swaps)
-- =========================================================================

INSERT INTO exercise_alternatives (exercise_id, alternative_exercise_id, equipment_context) VALUES
  -- Home alternatives (bodyweight)
  ((SELECT id FROM exercises WHERE name = 'Développé couché'),       (SELECT id FROM exercises WHERE name = 'Pompes'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Papillon bras tendus'),   (SELECT id FROM exercises WHERE name = 'Pompes'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Pec Deck bras tendus'),   (SELECT id FROM exercises WHERE name = 'Pompes'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Tirage latéral prise large'), (SELECT id FROM exercises WHERE name = 'Tractions'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Rangées prise serrée neutre'), (SELECT id FROM exercises WHERE name = 'Tractions'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Rangées prise large pronation'), (SELECT id FROM exercises WHERE name = 'Tractions'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Extension triceps corde'), (SELECT id FROM exercises WHERE name = 'Dips'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Skull Crusher incliné'),  (SELECT id FROM exercises WHERE name = 'Dips'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Crunch assis machine'),   (SELECT id FROM exercises WHERE name = 'Crunchs'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Crunch à genoux poulie'), (SELECT id FROM exercises WHERE name = 'Crunchs'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Extension du dos machine'), (SELECT id FROM exercises WHERE name = 'Gainage planche'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Presse à cuisse'),        (SELECT id FROM exercises WHERE name = 'Squat au poids du corps'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Extension de jambe machine'), (SELECT id FROM exercises WHERE name = 'Squat au poids du corps'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Élévation mollet machine'), (SELECT id FROM exercises WHERE name = 'Élévation mollet debout'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Extension mollet machine'), (SELECT id FROM exercises WHERE name = 'Élévation mollet debout'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Squat barre'),             (SELECT id FROM exercises WHERE name = 'Squat au poids du corps'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Soulevé de terre'),       (SELECT id FROM exercises WHERE name = 'Gainage planche'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Soulevé de terre roumain'), (SELECT id FROM exercises WHERE name = 'Gainage planche'), 'home'),
  ((SELECT id FROM exercises WHERE name = 'Leg Curl assis'),         (SELECT id FROM exercises WHERE name = 'Squat au poids du corps'), 'home'),
  -- Minimal alternatives (dumbbells, no machines/cables/barbells)
  ((SELECT id FROM exercises WHERE name = 'Squat barre'),            (SELECT id FROM exercises WHERE name = 'Fentes haltères'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Soulevé de terre'),       (SELECT id FROM exercises WHERE name = 'Soulevé de terre roumain'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Leg Curl assis'),         (SELECT id FROM exercises WHERE name = 'Soulevé de terre roumain'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Développé couché'),       (SELECT id FROM exercises WHERE name = 'Développé haltères'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Papillon bras tendus'),   (SELECT id FROM exercises WHERE name = 'Développé haltères'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Pec Deck bras tendus'),   (SELECT id FROM exercises WHERE name = 'Développé haltères'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Tirage latéral prise large'), (SELECT id FROM exercises WHERE name = 'Rowing haltère'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Rangées prise serrée neutre'), (SELECT id FROM exercises WHERE name = 'Rowing haltère'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Rangées prise large pronation'), (SELECT id FROM exercises WHERE name = 'Rowing haltère'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Extension triceps corde'), (SELECT id FROM exercises WHERE name = 'Extension triceps haltère'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Skull Crusher incliné'),  (SELECT id FROM exercises WHERE name = 'Extension triceps haltère'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Curls stricts barre'),    (SELECT id FROM exercises WHERE name = 'Curl marteau haltères'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Crunch assis machine'),   (SELECT id FROM exercises WHERE name = 'Crunchs'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Crunch à genoux poulie'), (SELECT id FROM exercises WHERE name = 'Crunchs'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Extension du dos machine'), (SELECT id FROM exercises WHERE name = 'Gainage planche'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Presse à cuisse'),        (SELECT id FROM exercises WHERE name = 'Fentes haltères'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Extension de jambe machine'), (SELECT id FROM exercises WHERE name = 'Fentes haltères'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Élévation mollet machine'), (SELECT id FROM exercises WHERE name = 'Élévation mollet debout'), 'minimal'),
  ((SELECT id FROM exercises WHERE name = 'Extension mollet machine'), (SELECT id FROM exercises WHERE name = 'Élévation mollet debout'), 'minimal');

-- =========================================================================
-- New Program Templates (also inserted by migrations 210000 + 220000;
-- ON CONFLICT keeps seed.sql idempotent after those migrations run)
-- =========================================================================

INSERT INTO program_templates (name, description, min_days, max_days, primary_goal, experience_tags) VALUES
  ('Bodyweight Full Body', 'Zero equipment needed. 3 full body sessions per week using push-ups, pull-ups, dips, squats and core work. Progressive overload through reps and tempo. Perfect first program for training at home.', 3, 3, 'general_fitness', '{beginner,intermediate}'),
  ('Home Dumbbell Upper/Lower', 'All you need is a pair of dumbbells. Upper push, lower body, and upper pull split. Enough volume for real hypertrophy with minimal gear. Add bodyweight finishers for extra stimulus.', 3, 3, 'hypertrophy', '{beginner,intermediate}'),
  ('5x5 Compound Strength', 'The proven minimalist approach to getting strong. Three heavy compound lifts per session — squat, bench, deadlift, overhead press, rows. Low reps, long rest, linear progression. No fluff.', 3, 3, 'strength', '{intermediate,advanced}'),
  ('Machine Hypertrophy', 'Guided movements on machines and cables for safe, effective muscle growth. Ideal for beginners who want to build muscle without the learning curve of free weights. Full body coverage across 3 sessions.', 3, 3, 'hypertrophy', '{beginner}'),
  ('Lower Body Emphasis', 'Two dedicated leg days plus one upper maintenance day. Squats, hip thrusts, Romanian deadlifts, leg press, lunges — everything to build serious lower body strength and size.', 3, 3, 'hypertrophy', '{intermediate,advanced}'),
  ('Dumbbell Strength', 'Heavy dumbbell work with lower reps and longer rest. A real strength program for anyone with a pair of dumbbells and a pull-up bar. No machines, no barbells, no excuses.', 3, 3, 'strength', '{beginner,intermediate}')
ON CONFLICT (name) DO NOTHING;
-- Days and exercises for these 6 templates are inserted by migrations
-- 20260315210000 and 20260315220000. No duplication needed here since
-- template_days/template_exercises have no unique constraints.
