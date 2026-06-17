import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

async function confirmAction({
  title,
  text,
  confirmButtonText,
  icon = 'question',
  confirmButtonColor = '#059669'
}) {
  const result = await Swal.fire({
    title,
    text,
    icon,
    background: '#111827',
    color: '#F9FAFB',
    confirmButtonText,
    confirmButtonColor,
    cancelButtonText: 'Cancel',
    showCancelButton: true,
    reverseButtons: true,
    buttonsStyling: true
  });

  return result.isConfirmed;
}

export { confirmAction };
