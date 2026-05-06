"""
Tests para la lógica de sincronización de imágenes.
Ejecutar: python -m pytest sync-neon/test_sync_imagenes.py -v
         (desde la raíz del proyecto)
"""
import sys
import os
import unittest
from unittest.mock import patch, MagicMock

# Mockear dependencias externas ANTES de importar el módulo
for mod in ('cloudinary', 'cloudinary.uploader', 'cloudinary.api',
            'dbfread', 'psycopg2', 'psycopg2.extras', 'dotenv'):
    sys.modules[mod] = MagicMock()

# Asegurar que el directorio del script esté en el path
sys.path.insert(0, os.path.dirname(__file__))

from sync_winfac_neon import _build_pendientes  # noqa: E402


class TestBuildPendientes(unittest.TestCase):

    def test_salta_existentes_en_cloudinary(self):
        """Archivos cuyo nombre (sin ext) ya está en cloudinary_map deben omitirse."""
        archivos = ['a.jpg', 'b.jpg', 'c.jpg']
        cloudinary_map = {'a': 1_000_000.0, 'b': 1_000_000.0}
        with patch('os.path.getctime', return_value=999.0):
            resultado = _build_pendientes(archivos, cloudinary_map, '/fake')
        nombres = [os.path.splitext(f)[0] for f in resultado]
        self.assertNotIn('a', nombres)
        self.assertNotIn('b', nombres)
        self.assertIn('c', nombres)

    def test_ordena_pendientes_por_ctime_desc(self):
        """Los pendientes deben venir ordenados de más reciente a más antiguo."""
        archivos = ['old.jpg', 'mid.jpg', 'new.jpg']
        ctimes = {
            os.path.join('/fake', 'old.jpg'): 1000.0,
            os.path.join('/fake', 'mid.jpg'): 2000.0,
            os.path.join('/fake', 'new.jpg'): 3000.0,
        }
        with patch('os.path.getctime', side_effect=lambda p: ctimes[p]):
            resultado = _build_pendientes(archivos, {}, '/fake')
        self.assertEqual(resultado, ['new.jpg', 'mid.jpg', 'old.jpg'])

    def test_lista_vacia_si_todo_ya_subido(self):
        """Si todos los archivos están en Cloudinary, retorna lista vacía."""
        archivos = ['x.jpg', 'y.png']
        cloudinary_map = {'x': 1.0, 'y': 1.0}
        with patch('os.path.getctime', return_value=1.0):
            resultado = _build_pendientes(archivos, cloudinary_map, '/fake')
        self.assertEqual(resultado, [])


if __name__ == '__main__':
    unittest.main()
