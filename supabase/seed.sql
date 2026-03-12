-- YouTube link curation rules:
--   - Duration < 2 minutes (form demo, not full workout)
--   - Must match the exact exercise variation
--   - Prefer recognized trainers / channels (AthleanX, Jeff Nippard, Buff Dudes, Live Lean TV, Bodybuilding.com, etc.)
--   - No unrelated, full-workout, or excessively long content
INSERT INTO exercises (name, muscle_group, emoji, is_system, youtube_url, instructions, image_url) VALUES

  -- 1. Arnold Press Haltères (Épaules)
  ('Arnold Press Haltères', 'Épaules', '🏋️', true,
   'https://www.youtube.com/watch?v=6Z15_WdXmVw',
   '{"setup":["Asseyez-vous sur un banc avec dossier, un haltère dans chaque main.","Amenez les haltères au niveau des épaules, paumes vers vous.","Gardez le dos droit et les pieds à plat au sol."],"movement":["Poussez les haltères vers le haut en tournant les paumes vers l''avant.","Tendez les bras au-dessus de la tête sans verrouiller les coudes.","Redescendez en inversant la rotation jusqu''à la position initiale."],"breathing":["Expirez en poussant les haltères vers le haut.","Inspirez en redescendant à la position de départ."],"common_mistakes":["Arquer excessivement le dos pendant la poussée.","Utiliser un élan du corps pour monter les haltères.","Négliger la rotation complète des poignets.","Verrouiller les coudes en haut du mouvement."]}',
   'arnold-press-halteres.png'),

  -- 2. Papillon bras tendus (Pectoraux)
  ('Papillon bras tendus', 'Pectoraux', '🦅', true,
   'https://www.youtube.com/watch?v=iaFzPXaPLHo',
   '{"setup":["Asseyez-vous sur la machine, dos bien plaqué contre le dossier.","Saisissez les poignées avec les bras quasi tendus à hauteur d''épaules.","Réglez le siège pour aligner les bras avec le milieu de la poitrine."],"movement":["Rapprochez les poignées devant vous en contractant les pectoraux.","Maintenez une légère flexion des coudes durant tout le mouvement.","Revenez lentement en ouvrant les bras sans dépasser l''alignement des épaules."],"breathing":["Expirez en rapprochant les poignées.","Inspirez en ouvrant les bras."],"common_mistakes":["Décoller le dos du dossier pendant l''effort.","Ouvrir les bras trop loin en arrière, ce qui stresse les épaules.","Utiliser l''élan au lieu de contrôler le mouvement."]}',
   'papillon-bras-tendus.png'),

  -- 3. Élévations latérales (Épaules)
  ('Élévations latérales', 'Épaules', '🙆', true,
   'https://www.youtube.com/watch?v=HeovYNoZDRg',
   '{"setup":["Debout, pieds écartés à largeur d''épaules, un haltère dans chaque main.","Gardez les bras le long du corps, paumes tournées vers les cuisses.","Fléchissez légèrement les genoux et gardez le buste droit."],"movement":["Levez les bras sur les côtés jusqu''à la hauteur des épaules.","Gardez une légère flexion des coudes tout au long du mouvement.","Redescendez lentement sans laisser tomber les haltères."],"breathing":["Expirez en montant les bras.","Inspirez en redescendant."],"common_mistakes":["Monter les épaules vers les oreilles (les trapèzes prennent le relais).","Balancer le corps pour donner de l''élan.","Lever les bras au-dessus de la ligne des épaules.","Utiliser des haltères trop lourds."]}',
   'elevations-laterales.png'),

  -- 4. Skull Crusher incliné (Triceps)
  ('Skull Crusher incliné', 'Triceps', '💀', true,
   'https://www.youtube.com/watch?v=-h6KL7ierzc',
   '{"setup":["Allongez-vous sur un banc incliné à 30-45 degrés.","Tenez la barre ou les haltères bras tendus au-dessus de la poitrine.","Serrez les coudes à largeur d''épaules, pieds au sol."],"movement":["Fléchissez les coudes pour descendre la charge vers le front.","Gardez les coudes immobiles, seuls les avant-bras bougent.","Remontez en tendant les bras complètement."],"breathing":["Inspirez en descendant la charge.","Expirez en poussant vers le haut."],"common_mistakes":["Écarter les coudes pendant le mouvement.","Descendre la charge trop vite sans contrôle.","Utiliser l''élan des épaules pour remonter."]}',
   'skull-crusher-incline.png'),

  -- 5. Presse à cuisse (Quadriceps)
  ('Presse à cuisse', 'Quadriceps', '🦵', true,
   'https://www.youtube.com/watch?v=jA9tsYbA7Ms',
   '{"setup":["Asseyez-vous sur la machine, dos et tête contre le dossier.","Placez les pieds au milieu de la plateforme, écartés largeur d''épaules.","Orteils légèrement tournés vers l''extérieur."],"movement":["Fléchissez les genoux pour descendre la plateforme à environ 90 degrés.","Poussez avec les talons pour remonter sans verrouiller les genoux.","Contrôlez la descente lentement."],"breathing":["Inspirez en descendant la plateforme.","Expirez en poussant vers le haut."],"common_mistakes":["Décoller les hanches ou le dos du siège.","Verrouiller complètement les genoux en haut.","Descendre trop bas, ce qui arrondit le bas du dos.","Pousser sur les orteils au lieu des talons."]}',
   'presse-a-cuisse.png'),

  -- 6. Élévation mollet machine (Mollets)
  ('Élévation mollet machine', 'Mollets', '🦶', true,
   'https://www.youtube.com/watch?v=MAMzF7iZNkc',
   '{"setup":["Placez-vous debout dans la machine, épaules sous les coussinets.","Positionnez l''avant des pieds sur le bord de la plateforme.","Gardez les jambes quasi tendues et le dos droit."],"movement":["Montez sur la pointe des pieds le plus haut possible.","Maintenez la contraction en haut pendant une seconde.","Redescendez lentement les talons sous le niveau de la plateforme."],"breathing":["Expirez en montant sur les pointes.","Inspirez en redescendant."],"common_mistakes":["Fléchir les genoux pendant le mouvement.","Rebondir en bas sans contrôler la descente.","Ne pas utiliser toute l''amplitude du mouvement."]}',
   'elevation-mollet-machine.png'),

  -- 7. Crunch assis machine (Abdos)
  ('Crunch assis machine', 'Abdos', '🔥', true,
   'https://www.youtube.com/watch?v=CNHS2OoUi30',
   '{"setup":["Asseyez-vous sur la machine, pieds calés sous les rouleaux.","Saisissez les poignées au niveau de la tête.","Ajustez le siège pour que l''axe de rotation soit au niveau de la taille."],"movement":["Enroulez le buste vers l''avant en contractant les abdominaux.","Maintenez la contraction une seconde en fin de mouvement.","Revenez lentement en position initiale en résistant à la charge."],"breathing":["Expirez en enroulant le buste.","Inspirez en revenant en position initiale."],"common_mistakes":["Tirer avec les bras au lieu de contracter les abdos.","Utiliser l''élan pour descendre.","Choisir une charge trop lourde qui empêche un bon enroulement."]}',
   'crunch-assis-machine.png'),

  -- 8. Rangées prise serrée neutre (Dos)
  ('Rangées prise serrée neutre', 'Dos', '🚣', true,
   'https://www.youtube.com/watch?v=xjlz8lRXOOI',
   '{"setup":["Asseyez-vous face à la machine, poitrine contre le support.","Saisissez les poignées en prise neutre (paumes face à face).","Gardez le dos droit et les pieds bien ancrés au sol."],"movement":["Tirez les poignées vers l''abdomen en serrant les omoplates.","Gardez les coudes près du corps pendant le tirage.","Revenez lentement bras quasi tendus sans relâcher la tension."],"breathing":["Expirez en tirant les poignées vers vous.","Inspirez en revenant à la position de départ."],"common_mistakes":["Arrondir le dos pendant le tirage.","Donner un élan avec le buste pour tricher.","Tirer uniquement avec les bras sans engager le dos.","Tendre complètement les bras en fin d''extension."]}',
   'rangees-prise-serree-neutre.png'),

  -- 9. Rangées prise large pronation (Dos)
  ('Rangées prise large pronation', 'Dos', '💪', true,
   'https://www.youtube.com/watch?v=y7h823PdWIY',
   '{"setup":["Asseyez-vous face à la machine, poitrine contre le support.","Saisissez les poignées larges en pronation (paumes vers le bas).","Ajustez le siège pour avoir les bras parallèles au sol."],"movement":["Tirez les poignées vers la poitrine en écartant les coudes.","Serrez les omoplates en fin de mouvement.","Revenez lentement sans tendre complètement les bras."],"breathing":["Expirez en tirant vers vous.","Inspirez en relâchant vers l''avant."],"common_mistakes":["Pencher le buste vers l''arrière pour tricher.","Fermer les coudes au lieu de les garder ouverts.","Relâcher brutalement la charge en retour."]}',
   'rangees-prise-large-pronation.png'),

  -- 10. Curls biceps inclinés (Biceps)
  ('Curls biceps inclinés', 'Biceps', '💪', true,
   'https://www.youtube.com/watch?v=b4jOP-spQW8',
   '{"setup":["Réglez le banc incliné à 45 degrés.","Asseyez-vous dos bien plaqué, un haltère dans chaque main.","Laissez pendre les bras, paumes vers l''avant."],"movement":["Fléchissez les coudes pour monter les haltères vers les épaules.","Gardez les coudes immobiles, seuls les avant-bras bougent.","Redescendez lentement pendant 2 à 3 secondes."],"breathing":["Expirez en montant les haltères.","Inspirez en les redescendant."],"common_mistakes":["Avancer les coudes pendant la montée.","Balancer le corps pour aider à soulever.","Descendre trop vite sans phase excentrique.","Ne pas descendre jusqu''à l''extension complète."]}',
   'curls-biceps-inclines.png'),

  -- 11. Papillon inverse (Deltoïdes post.)
  ('Papillon inverse', 'Deltoïdes post.', '🦅', true,
   'https://www.youtube.com/watch?v=Y7ZKBP5bMwg',
   '{"setup":["Asseyez-vous face au dossier de la machine à papillon.","Saisissez les poignées avec les bras à hauteur d''épaules.","Gardez le buste plaqué contre le support."],"movement":["Écartez les bras vers l''arrière en serrant les omoplates.","Maintenez la contraction une seconde en fin de mouvement.","Revenez lentement sans laisser les poids se reposer."],"breathing":["Expirez en écartant les bras.","Inspirez en revenant."],"common_mistakes":["Décoller la poitrine du support.","Utiliser trop de poids et compenser avec le dos.","Faire un mouvement trop rapide sans contrôle."]}',
   'papillon-inverse.png'),

  -- 12. Shrugs haltères (Trapèzes)
  ('Shrugs haltères', 'Trapèzes', '🤷', true,
   'https://www.youtube.com/watch?v=nwSmkoHM-Jw',
   '{"setup":["Debout, pieds largeur d''épaules, un haltère dans chaque main.","Bras le long du corps, paumes tournées vers les cuisses.","Gardez le dos droit et le regard devant vous."],"movement":["Montez les épaules vers les oreilles le plus haut possible.","Maintenez la contraction en haut une seconde.","Redescendez lentement les épaules en position initiale."],"breathing":["Expirez en montant les épaules.","Inspirez en redescendant."],"common_mistakes":["Faire des rotations avec les épaules (risque de blessure).","Fléchir les coudes pour aider à monter.","Pencher la tête vers l''avant.","Utiliser l''élan pour soulever."]}',
   'shrugs-halteres.png'),

  -- 13. Soulevé de terre roumain (Ischios / Bas du dos)
  ('Soulevé de terre roumain', 'Ischios / Bas du dos', '🏋️', true,
   'https://www.youtube.com/watch?v=5jO4u1HFkTA',
   '{"setup":["Debout, pieds largeur de bassin, barre ou haltères en mains.","Tirez les épaules en arrière et bombez légèrement la poitrine.","Fléchissez légèrement les genoux."],"movement":["Penchez le buste vers l''avant en poussant les fesses vers l''arrière.","Descendez la charge le long des jambes, dos toujours droit.","Remontez en contractant les fessiers et les ischio-jambiers."],"breathing":["Inspirez en descendant.","Expirez en remontant."],"common_mistakes":["Arrondir le bas du dos pendant la descente.","Garder les jambes complètement tendues.","Éloigner la barre du corps.","Descendre trop bas au-delà de la souplesse naturelle."]}',
   'souleve-de-terre-roumain.png'),

  -- 14. Extension du dos machine (Lombaires)
  ('Extension du dos machine', 'Lombaires', '🔙', true,
   'https://www.youtube.com/watch?v=iSIFVCzzNOY',
   '{"setup":["Asseyez-vous sur la machine, dos contre le coussin mobile.","Calez les pieds sur les repose-pieds.","Réglez la machine pour que les hanches soient à environ 90 degrés."],"movement":["Poussez le coussin vers l''arrière en contractant les lombaires.","Maintenez la position une seconde en extension.","Revenez lentement en position initiale sans relâcher la tension."],"breathing":["Expirez en poussant vers l''arrière.","Inspirez en revenant."],"common_mistakes":["Aller trop loin en hyperextension du dos.","Faire le mouvement trop rapidement.","Utiliser une charge trop lourde."]}',
   'extension-du-dos-machine.png'),

  -- 15. Crunch à genoux poulie (Abdos)
  ('Crunch à genoux poulie', 'Abdos', '🔥', true,
   'https://www.youtube.com/watch?v=NJQROeaBiVE',
   '{"setup":["Agenouillez-vous sous la poulie haute, face à la machine.","Saisissez la corde et placez les mains de chaque côté de la tête.","Gardez les hanches fixes au-dessus des genoux."],"movement":["Enroulez le buste vers le bas en contractant fortement les abdominaux.","Rapprochez les coudes des genoux sans bouger les hanches.","Remontez lentement en résistant à la charge."],"breathing":["Expirez en enroulant le buste.","Inspirez en remontant."],"common_mistakes":["Tirer avec les bras au lieu des abdominaux.","Bouger les hanches pour tricher.","Ne pas enrouler le dos (flexion du tronc insuffisante).","S''asseoir sur les talons au lieu de rester droit."]}',
   'crunch-a-genoux-poulie.png'),

  -- 16. Développé couché (Pectoraux)
  ('Développé couché', 'Pectoraux', '🏋️', true,
   'https://www.youtube.com/watch?v=0cXAp6WhSj4',
   '{"setup":["Allongez-vous sur le banc, yeux sous la barre.","Saisissez la barre un peu plus large que les épaules.","Serrez les omoplates et posez les pieds à plat au sol."],"movement":["Décrochez la barre et descendez-la vers le bas des pectoraux.","Gardez les coudes à environ 45 degrés du corps.","Poussez la barre vers le haut jusqu''à l''extension des bras."],"breathing":["Inspirez en descendant la barre.","Expirez en poussant."],"common_mistakes":["Rebondir la barre sur la poitrine.","Écarter les coudes à 90 degrés (stresse les épaules).","Décoller les fesses du banc.","Ne pas serrer les omoplates."]}',
   'developpe-couche.png'),

  -- 17. Tirage latéral prise large (Dos)
  ('Tirage latéral prise large', 'Dos', '🚣', true,
   'https://www.youtube.com/watch?v=lueEJGjTuPQ',
   '{"setup":["Asseyez-vous face à la machine, cuisses calées sous les rouleaux.","Saisissez la barre large en pronation (paumes vers l''avant).","Gardez le buste droit et la poitrine sortie."],"movement":["Tirez la barre vers le haut de la poitrine en dirigeant les coudes vers le bas.","Serrez les omoplates en fin de mouvement.","Remontez la barre lentement bras quasi tendus."],"breathing":["Expirez en tirant la barre vers vous.","Inspirez en remontant la barre."],"common_mistakes":["Tirer la barre derrière la nuque (danger pour les épaules).","Se pencher excessivement en arrière.","Tirer uniquement avec les bras sans engager les dorsaux.","Verrouiller les coudes en haut du mouvement."]}',
   'tirage-lateral-prise-large.png'),

  -- 18. Pec Deck bras tendus (Pectoraux)
  ('Pec Deck bras tendus', 'Pectoraux', '🦅', true,
   'https://www.youtube.com/watch?v=iaFzPXaPLHo',
   '{"setup":["Asseyez-vous sur la machine, dos bien plaqué contre le dossier.","Saisissez les poignées bras tendus à hauteur de poitrine.","Réglez le siège pour aligner les bras avec le milieu des pectoraux."],"movement":["Rapprochez les poignées devant vous en serrant les pectoraux.","Maintenez la contraction une seconde, bras quasi tendus.","Revenez lentement sans dépasser l''alignement des épaules."],"breathing":["Expirez en fermant les bras.","Inspirez en les ouvrant."],"common_mistakes":["Décoller le dos du dossier.","Fléchir les coudes au lieu de garder les bras tendus.","Ouvrir les bras trop loin en arrière."]}',
   'pec-deck-bras-tendus.png'),

  -- 19. Extension triceps corde (Triceps)
  ('Extension triceps corde', 'Triceps', '💪', true,
   'https://www.youtube.com/watch?v=5Yv-2CCMqxM',
   '{"setup":["Debout face à la poulie haute, saisissez la corde à deux mains.","Gardez les coudes collés au corps, avant-bras parallèles au sol.","Pieds largeur d''épaules, genoux légèrement fléchis."],"movement":["Poussez la corde vers le bas en tendant les bras.","Écartez les extrémités de la corde en bas du mouvement.","Remontez lentement jusqu''à ce que les avant-bras soient parallèles au sol."],"breathing":["Expirez en poussant vers le bas.","Inspirez en remontant."],"common_mistakes":["Décoller les coudes du corps.","Pencher le buste vers l''avant pour tricher.","Remonter les mains plus haut que la position de départ.","Utiliser un poids trop lourd qui empêche l''extension complète."]}',
   'extension-triceps-corde.png'),

  -- 20. Curls stricts barre (Biceps)
  ('Curls stricts barre', 'Biceps', '🦾', true,
   'https://www.youtube.com/watch?v=rXfGNkxUZks',
   '{"setup":["Debout, pieds largeur d''épaules, barre en mains, paumes vers l''avant.","Dos droit, épaules en arrière, coudes le long du corps.","Gardez le corps parfaitement immobile."],"movement":["Fléchissez les coudes pour monter la barre vers les épaules.","Gardez les coudes fixes et le dos droit, sans tricher.","Redescendez lentement jusqu''à l''extension complète des bras."],"breathing":["Expirez en montant la barre.","Inspirez en redescendant."],"common_mistakes":["Balancer le buste d''avant en arrière.","Avancer les coudes pour faciliter la montée.","Descendre trop vite sans phase excentrique.","Utiliser un poids trop lourd qui force à tricher."]}',
   'curls-stricts-barre.png'),

  -- 21. Extension de jambe machine (Quadriceps)
  ('Extension de jambe machine', 'Quadriceps', '🦵', true,
   'https://www.youtube.com/watch?v=gI0cn4DMFFI',
   '{"setup":["Asseyez-vous sur la machine, dos collé au dossier.","Placez le coussin juste au-dessus des chevilles.","Alignez l''axe de rotation de la machine avec vos genoux."],"movement":["Tendez les jambes en contractant les quadriceps.","Maintenez la contraction une seconde en haut.","Redescendez lentement sans laisser retomber la charge."],"breathing":["Expirez en tendant les jambes.","Inspirez en redescendant."],"common_mistakes":["Donner un élan pour soulever la charge.","Décoller les fesses du siège.","Verrouiller brutalement les genoux en extension.","Descendre trop vite sans contrôle."]}',
   'extension-de-jambe-machine.png'),

  -- 22. Leg Curl assis (Ischios)
  ('Leg Curl assis', 'Ischios', '🦵', true,
   'https://www.youtube.com/watch?v=Ne5MBQdvUwA',
   '{"setup":["Asseyez-vous sur la machine, dos contre le dossier.","Placez les chevilles devant le rouleau inférieur.","Calez les cuisses sous le coussin de maintien."],"movement":["Fléchissez les genoux pour ramener les talons sous les cuisses.","Maintenez la contraction des ischio-jambiers une seconde.","Remontez lentement sans tendre complètement les jambes."],"breathing":["Expirez en fléchissant les jambes.","Inspirez en revenant."],"common_mistakes":["Lever les hanches du siège pendant l''effort.","Utiliser l''élan pour descendre la charge.","Relâcher trop vite en phase de retour.","Cambrer le bas du dos."]}',
   'leg-curl-assis.png'),

  -- 23. Extension mollet machine (Mollets)
  ('Extension mollet machine', 'Mollets', '🦶', true,
   'https://www.youtube.com/watch?v=SVmM6a0dHGU',
   '{"setup":["Asseyez-vous sur la machine à mollets, genoux sous les coussinets.","Placez l''avant des pieds sur la plateforme, talons dans le vide.","Gardez le dos droit et les mains sur les poignées."],"movement":["Poussez sur les orteils pour lever les talons le plus haut possible.","Maintenez la contraction en haut pendant 2 secondes.","Redescendez lentement les talons sous le niveau de la plateforme."],"breathing":["Expirez en montant les talons.","Inspirez en redescendant."],"common_mistakes":["Faire des mouvements rapides et saccadés.","Ne pas descendre assez bas pour étirer le mollet.","Utiliser l''élan au lieu de contrôler la charge."]}',
   'extension-mollet-machine.png');
