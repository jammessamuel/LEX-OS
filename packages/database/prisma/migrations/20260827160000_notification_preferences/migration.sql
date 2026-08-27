-- Preferência de avisos por pessoa (ADR-013).
--
-- Guarda o que a pessoa DESLIGOU, e não o que ligou: quem nunca mexeu recebe os avisos, que é
-- o comportamento útil. Guardar o inverso faria toda conta nova nascer silenciosa, e o aviso
-- que ninguém recebe é o mesmo que aviso que não existe.
--
-- Falha de documento não é silenciável e por isso nunca aparece aqui. A garantia não é uma
-- restrição nesta coluna: é o gatilho de falha não consultar preferência nenhuma.

-- AlterTable
ALTER TABLE "users"
    ADD COLUMN "silenced_notifications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
